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
  cookie: { secure: true }
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
let userIdSignedIn = -1;

async function fetchCocktails() {
    try {
        // First try to get all cocktails at once
        const response = await fetch('https://www.thecocktaildb.com/api/json/v1/1/list.php?c=list');
        const data = await response.json();
        
        if (data.drinks) {
            // For each category, fetch its drinks
            const categoryPromises = data.drinks.map(async (category) => {
                const catResponse = await fetch(`https://www.thecocktaildb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(category.strCategory)}`);
                const catData = await catResponse.json();
                return catData.drinks || [];
            });
            
            const allCategoryDrinks = await Promise.all(categoryPromises);
            const allDrinks = new Set(
                allCategoryDrinks
                    .flat()
                    .map(drink => drink.strDrink)
            );
            
            return Array.from(allDrinks).sort();
        }
        return [];
    } catch (error) {
        console.error('Error fetching cocktails:', error);
        return [];
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/welcome', (req, res) => {
    res.render('welcome');
});

app.get('/find', (req, res) => {
    res.render('find');
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
    let sql = 'INSERT INTO Comments (text, likes, userId, postId) VALUES (?,?,?,?)';
    let sqlParams = [commentContent, 0, userIdSignedIn, postId]
    const [rows] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});

app.get('/posts', async (req, res) => {
    let sql = 'SELECT * FROM Posts NATURAL JOIN users ORDER BY postId DESC';
    const drinks = await fetchCocktails();
    const [posts] = await conn.query(sql);
    let UserSql = `SELECT * FROM users WHERE userId = ?`;
    let sqlParams = [userIdSignedIn];
    const [user] = await conn.query(UserSql, sqlParams);
    let sqlComments = 'SELECT * FROM Comments NATURAL JOIN users';
    const [comments] = await conn.query(sqlComments);
    res.render('posts', { posts, drinks, user, comments});
    
});

app.post('/posts', async (req, res) => {
    const {username, drinkList, caption } = req.body;
    const conn = await pool.getConnection();
    const drinks = Array.isArray(drinkList) ? drinkList.join(', ') : (drinkList || '');
    const content = `Drinks: ${drinks}`; 
    let sql = 'INSERT INTO Posts (userId, content, caption, likes) VALUES (?, ?, ?, ?)';
    let sqlParams = [username, content, caption, 0];
    const [posts] = await conn.query(sql, sqlParams);
    res.redirect('/posts');
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });

app.get('/profile', isAuthenticated, (req, res) => {
    res.render('profile.ejs');
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

    let sql = `INSERT INTO users 
               (firstName, 
                lastName, 
                username, 
                password) 
                VALUES(?, ?, ?, ?)`;
    let sqlParams = [fName, lName, username, hashedPassword];
            
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
    userIdSignedIn = rows[0].userId;

    let passwordHash;
    if(rows.length > 0) { 
        passwordHash = rows[0].password;
    } else {
        res.redirect('/welcome');
    }
    const match = await bcrypt.compare(password, passwordHash);
    if(match) {
        req.session.authenticated = true;
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