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
}))

const pool = mysql.createPool({
    host: "aureliano-khoury.tech",
    user: "aurelia1_webuser",
    password: "100webuser",
    database: "aurelia1_quotes",
    connectionLimit: 10,
    waitForConnections: true
});
const conn = await pool.getConnection();

async function fetchCocktails() {
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
}

async function fetchCocktailDetails(name) {
    let response = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${name}`);
    let data = await response.json();
    return data.drinks ? data.drinks[0] : null;
}

// Routes

app.get('/', (req, res) => {
    res.render('login');
});

app.get('/welcome', isAuthenticated, (req, res) => {
    res.render('welcome');
});

app.get('/find', isAuthenticated, async (req, res) => {
    let drinks = await fetchCocktails();
    res.render('find', { drinks });
});


app.get('/random', isAuthenticated, async (req, res) => {
    let drinks = await fetchCocktails();
    let randomNumber = Math.floor(Math.random() * drinks.length);
    let random = drinks[randomNumber];
    let response = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${random}`);
    let data = await response.json();
    let drink = data.drinks[0];
    res.render('random', {drink})
});

app.get('/cocktail/:name', async (req, res) => {
    // console.log(req.params.name);
    const cocktail = await fetchCocktailDetails(req.params.name);
    res.json(cocktail);
});

app.post('/like', async (req, res) => {
    const { postId } = req.body;
    let getLikesSql = 'SELECT likes FROM Posts WHERE postId = ?';
    let sqlParamsLike = [postId];
    const [likesTable] = await conn.query(getLikesSql, sqlParamsLike);
    let sql = 'UPDATE Posts SET likes = ? WHERE postId = ?';
    let sqlParams = [likesTable[0].likes + 1, postId]
    const [rows] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});

app.post('/likeComment', async (req, res) => {
    const { commentId } = req.body;
    let getLikesSql = 'SELECT likes FROM Comments WHERE commentId = ?';
    let sqlParamsLike = [commentId];
    const [likesTable] = await conn.query(getLikesSql, sqlParamsLike);
    let sql = 'UPDATE Comments SET likes = ? WHERE commentId = ?';
    let sqlParams = [likesTable[0].likes + 1, commentId]
    const [rows] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});


app.post('/comment', async (req, res) => {
    const { postId } = req.body;
    const { commentContent } = req.body;
    let currentDate = new Date();
    let formattedDate = currentDate.toISOString().split('T')[0];
    let sql = 'INSERT INTO Comments (text, likes, userId, postId, datePosted) VALUES (?,?,?,?,?)';
    let sqlParams = [commentContent, 0, req.session.user.id, postId, formattedDate];
    const [rows] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});

app.get('/posts', isAuthenticated, async (req, res) => {
    let keyword = req.query.keyword || '';
    let sql = 'SELECT * FROM Posts NATURAL JOIN users WHERE username LIKE ? ORDER BY postId DESC';
    let postSearch = [`%${keyword}%`];
    const drinks = await fetchCocktails();
    const [posts] = await conn.query(sql, postSearch);
    let UserSql = `SELECT * FROM users WHERE userId = ?`;
    let sqlParams = [req.session.user.id];
    const [user] = await conn.query(UserSql, sqlParams);
    let sqlComments = 'SELECT * FROM Comments NATURAL JOIN users';
    const [comments] = await conn.query(sqlComments);
    console.log(posts);
    res.render('posts', { posts, drinks, user: req.session.user.id, comments});
});

app.post('/posts', async (req, res) => {
    let drink = req.body.drinkList;
    let caption = req.body.caption;
    let content = `Drink: ${drink}`; 
    let cocktail = await fetchCocktailDetails(drink);
    let currentDate = new Date();
    let formattedDate = currentDate.toISOString().split('T')[0];
    let sql = 'INSERT INTO Posts (userId, content, caption, likes, image, instructions, datePosted) VALUES (?, ?, ?, ?, ?, ?, ?)';
    let sqlParams = [req.session.user.id, content, caption, 0, cocktail.strDrinkThumb, cocktail.strInstructions, formattedDate];

    let sqlUpdate = 'UPDATE users SET postCount = postCount + 1 WHERE userId = ?';
    let sqlParamsUpdate = [req.session.user.id];
    const [update] = await conn.query(sqlUpdate, sqlParamsUpdate);
    const [posts] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });

app.get('/profile', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM Posts NATURAL JOIN users WHERE userId = ? ORDER BY postId DESC`
    let sqlParams = req.session.user.id;
    const [posts] = await conn.query(sql, sqlParams);

    let sqlComments = 'SELECT * FROM Comments NATURAL JOIN users';
    const [comments] = await conn.query(sqlComments);
    
    res.render('profile.ejs', {user: req.session.user, posts, comments});
 });

app.get('/profile/edit', isAuthenticated, (req, res) => {
    res.render('editProfile.ejs', {user: req.session.user});
});

app.post('/profile/edit', isAuthenticated, async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let username = req.body.username;
    let userId = req.session.user.id;
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;
    req.session.user.username = username;
    let sql = `UPDATE users
               SET firstName =?,
               lastName = ?,
               username = ?
               WHERE userId = ?`;
    let sqlParams = [firstName, lastName, username, userId];
    const [userData] = await conn.query(sql, sqlParams);
    res.redirect('/profile');
});

app.get('/profile/deletePost', isAuthenticated, async (req, res) => {
    let postId = req.query.postId;
    let sql = `DELETE FROM Posts WHERE postId = ?`;
    const [rows] = await conn.query(sql, [postId]);

    res.redirect('/profile');
});

app.get('/comment/delete', isAuthenticated, async (req, res) => {
    let commentId = req.query.commentId;
    console.log(commentId);
    let sql = `DELETE FROM Comments WHERE commentId = ?`;
    const [rows] = await conn.query(sql, [commentId]);

    res.redirect('/posts');
});

app.get('/createAccount', (req, res) => {
    res.render('signup.ejs')
});

app.post('/signup', async (req, res) => {
    let fName = req.body.firstName;
    let lName = req.body.lastName;
    let username = req.body.username;
    let password = req.body.password;

    let userSql = `SELECT * 
                   FROM users 
                   WHERE username = ?`;
    let userParams = [username];
    const [unique] = await conn.query(userSql, userParams);
    if (unique.length > 0) {
        return res.status(400).send('Username already taken.');
    }
    
    let saltRounds = 10;
    let hashedPassword = await bcrypt.hash(password, saltRounds);

    let pfpURL = `https://robohash.org/${username}.png?set=set4`;

    let sql = `INSERT INTO users 
               (firstName, 
                lastName, 
                username, 
                password,
                profilePicture) 
                VALUES(?, ?, ?, ?, ?)`;
    let sqlParams = [fName, lName, username, hashedPassword, pfpURL];
            
    await conn.query(sql, sqlParams);
res.render('login.ejs')
});

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let sql = `SELECT * 
    FROM users
    WHERE username = ?`;
    let sqlParams = [username];
    const [rows] = await conn.query(sql, sqlParams);

    let passwordHash;
    if(rows.length > 0) { 
        passwordHash = rows[0].password;
    } else {
        res.redirect('/');
        return;
    }

    const match = await bcrypt.compare(password, passwordHash);
    if(match) {
        req.session.authenticated = true;
        req.session.user = {
            id: rows[0].userId,
            username: rows[0].username,
            firstName: rows[0].firstName,
            lastName: rows[0].lastName,
            pfp: rows[0].profilePicture
        };
        res.render('welcome.ejs');
    } else {
        res.redirect("/");
    }
 });

app.get('/costs', (req, res) => {
    res.render('costs');
});

app.get('/auth', (req, res) => {
    res.render('auth');
});

 // middleware fumctions
 function isAuthenticated(req, res, next) {
    if(req.session.authenticated) {
        next();
    } else {
        res.redirect('/');
    }
}

app.listen(3101, ()=>{
    console.log("Express server running")
})