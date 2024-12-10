import express from 'express';
import mysql from 'mysql2/promise';
import fetch from 'node-fetch';
import bcrypt from "bcrypt";
import session from 'express-session';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.set('trust proxy', 1);
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hour expiration
    }
}));

// pool configuration update
const pool = mysql.createPool({
    host: "aureliano-khoury.tech",
    user: "aurelia1_webuser",
    password: "100webuser",
    database: "aurelia1_quotes",
    connectionLimit: 10,
    waitForConnections: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 20000,
    acquireTimeout: 10000,
    idleTimeout: 60000
});

// Helper function for all database queries
async function executeQuery(sql, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.query(sql, params);
        return results;
    } catch (error) {
        console.error('Database error:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (error) {
                console.error('Error releasing connection:', error);
            }
        }
    }
}

// API helper functions
async function fetchCocktails() {
    try {
        let response = await fetch('https://www.thecocktaildb.com/api/json/v1/1/list.php?c=list');
        let data = await response.json();
        
        let categoryPromises = data.drinks.map(async (category) => {
            let catResponse = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/filter.php?c=${category.strCategory}`);
            let catData = await catResponse.json();
            return catData.drinks || [];
        });
                
        let allCategoryDrinks = await Promise.all(categoryPromises);
        let allDrinks = new Set(allCategoryDrinks.flat().map(drink => drink.strDrink));
                
        return Array.from(allDrinks).sort();
    } catch (error) {
        console.error('Error fetching cocktails:', error);
        throw error;
    }
}

async function fetchCocktailDetails(name) {
    try {
        let response = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${name}`);
        let data = await response.json();
        return data.drinks ? data.drinks[0] : null;
    } catch (error) {
        console.error('Error fetching cocktail details:', error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/welcome', isAuthenticated, (req, res) => {
    res.render('welcome');
});

app.get('/find', isAuthenticated, async (req, res) => {
    try {
        let drinks = await fetchCocktails();
        res.render('find', { drinks });
    } catch (error) {
        console.error('Error in /find:', error);
        res.status(500).send('An error occurred while fetching drinks');
    }
});

app.get('/random', isAuthenticated, async (req, res) => {
    try {
        let drinks = await fetchCocktails();
        let randomNumber = Math.floor(Math.random() * drinks.length);
        let random = drinks[randomNumber];
        let response = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${random}`);
        let data = await response.json();
        let drink = data.drinks[0];
        res.render('random', {drink});
    } catch (error) {
        console.error('Error in /random:', error);
        res.status(500).send('An error occurred while fetching random drink');
    }
});

app.get('/cocktail/:name', async (req, res) => {
    try {
        const cocktail = await fetchCocktailDetails(req.params.name);
        res.json(cocktail);
    } catch (error) {
        console.error('Error in /cocktail/:name:', error);
        res.status(500).send('An error occurred while fetching cocktail details');
    }
});

app.post('/like', async (req, res) => {
    try {
        const { postId } = req.body;
        let likes = await executeQuery('SELECT likes FROM Posts WHERE postId = ?', [postId]);
        await executeQuery('UPDATE Posts SET likes = ? WHERE postId = ?', [likes[0].likes + 1, postId]);
        res.redirect('/posts');
    } catch (error) {
        console.error('Error in /like:', error);
        res.status(500).send('An error occurred while updating likes');
    }
});

app.post('/likeComment', async (req, res) => {
    try {
        const { commentId } = req.body;
        let likes = await executeQuery('SELECT likes FROM Comments WHERE commentId = ?', [commentId]);
        await executeQuery('UPDATE Comments SET likes = ? WHERE commentId = ?', [likes[0].likes + 1, commentId]);
        res.redirect('/posts');
    } catch (error) {
        console.error('Error in /likeComment:', error);
        res.status(500).send('An error occurred while updating comment likes');
    }
});

app.post('/comment', async (req, res) => {
    try {
        const { postId, commentContent } = req.body;
        let currentDate = new Date().toISOString().split('T')[0];
        await executeQuery(
            'INSERT INTO Comments (text, likes, userId, postId, datePosted) VALUES (?,?,?,?,?)',
            [commentContent, 0, req.session.user.id, postId, currentDate]
        );
        res.redirect('/posts');
    } catch (error) {
        console.error('Error in /comment:', error);
        res.status(500).send('An error occurred while adding comment');
    }
});

app.get('/posts', isAuthenticated, async (req, res) => {
    try {
        let keyword = req.query.keyword || '';
        const posts = await executeQuery(
            'SELECT * FROM Posts NATURAL JOIN users WHERE username LIKE ? ORDER BY postId DESC',
            [`%${keyword}%`]
        );
        const drinks = await fetchCocktails();
        const comments = await executeQuery('SELECT * FROM Comments NATURAL JOIN users');
        res.render('posts', { posts, drinks, user: req.session.user.id, comments});
    } catch (error) {
        console.error('Error in /posts:', error);
        res.status(500).send('An error occurred while fetching posts');
    }
});

app.post('/posts', async (req, res) => {
    try {
        let { drinkList: drink, caption } = req.body;
        let content = `Drink: ${drink}`;
        let cocktail = await fetchCocktailDetails(drink);
        let currentDate = new Date().toISOString().split('T')[0];
        
        await executeQuery(
            'INSERT INTO Posts (userId, content, caption, likes, image, instructions, datePosted) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.session.user.id, content, caption, 0, cocktail.strDrinkThumb, cocktail.strInstructions, currentDate]
        );
        
        await executeQuery(
            'UPDATE users SET postCount = postCount + 1 WHERE userId = ?',
            [req.session.user.id]
        );
        
        res.redirect('/posts');
    } catch (error) {
        console.error('Error in POST /posts:', error);
        res.status(500).send('An error occurred while creating post');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('login.ejs');
});

app.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const posts = await executeQuery(
            'SELECT * FROM Posts NATURAL JOIN users WHERE userId = ? ORDER BY postId DESC',
            [req.session.user.id]
        );
        const comments = await executeQuery('SELECT * FROM Comments NATURAL JOIN users');
        res.render('profile.ejs', {user: req.session.user, posts, comments});
    } catch (error) {
        console.error('Error in /profile:', error);
        res.status(500).send('An error occurred while fetching profile');
    }
});

app.get('/profile/edit', isAuthenticated, (req, res) => {
    res.render('editProfile.ejs', {user: req.session.user});
});

app.post('/profile/edit', isAuthenticated, async (req, res) => {
    try {
        let { firstName, lastName, username } = req.body;
        let userId = req.session.user.id;
        
        req.session.user.firstName = firstName;
        req.session.user.lastName = lastName;
        req.session.user.username = username;
        
        await executeQuery(
            'UPDATE users SET firstName = ?, lastName = ?, username = ? WHERE userId = ?',
            [firstName, lastName, username, userId]
        );
        
        res.redirect('/profile');
    } catch (error) {
        console.error('Error in profile/edit:', error);
        res.status(500).send('An error occurred while updating profile');
    }
});

app.get('/profile/deletePost', isAuthenticated, async (req, res) => {
    try {
        await executeQuery('DELETE FROM Posts WHERE postId = ?', [req.query.postId]);
        res.redirect('/profile');
    } catch (error) {
        console.error('Error in profile/deletePost:', error);
        res.status(500).send('An error occurred while deleting post');
    }
});

app.get('/comment/delete', isAuthenticated, async (req, res) => {
    try {
        await executeQuery('DELETE FROM Comments WHERE commentId = ?', [req.query.commentId]);
        res.redirect('/posts');
    } catch (error) {
        console.error('Error in comment/delete:', error);
        res.status(500).send('An error occurred while deleting comment');
    }
});

app.get('/createAccount', (req, res) => {
    res.render('signup.ejs');
});

app.post('/signup', async (req, res) => {
    try {
        let { firstName: fName, lastName: lName, username, password } = req.body;

        const existingUser = await executeQuery('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).send('Username already taken.');
        }
        
        let saltRounds = 10;
        let hashedPassword = await bcrypt.hash(password, saltRounds);
        let pfpURL = `https://robohash.org/${username}.png?set=set4`;

        await executeQuery(
            'INSERT INTO users (firstName, lastName, username, password, profilePicture) VALUES(?, ?, ?, ?, ?)',
            [fName, lName, username, hashedPassword, pfpURL]
        );
        
        res.render('login.ejs');
    } catch (error) {
        console.error('Error in /signup:', error);
        res.status(500).send('An error occurred during signup');
    }
});

app.post('/login', async (req, res) => {
    try {
        let { username, password } = req.body;
        const users = await executeQuery('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            return res.redirect('/');
        }

        const match = await bcrypt.compare(password, users[0].password);
        if (match) {
            req.session.authenticated = true;
            req.session.user = {
                id: users[0].userId,
                username: users[0].username,
                firstName: users[0].firstName,
                lastName: users[0].lastName,
                pfp: users[0].profilePicture
            };
            res.render('welcome.ejs');
        } else {
            res.redirect("/");
        }
    } catch (error) {
        console.error('Error in /login:', error);
        res.status(500).send('An error occurred during login');
    }
});

app.get('/auth', (req, res) => {
    res.render('auth');
});

// Middleware functions
function isAuthenticated(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/');
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).send('An unexpected error occurred');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await pool.end();
        console.log('Database pool connections closed.');
        process.exit(0);
    } catch (error) {
        console.error('Error closing pool connections:', error);
        process.exit(1);
    }
});

app.listen(10099, () => {
    console.log("Express server running on port 10099");
});