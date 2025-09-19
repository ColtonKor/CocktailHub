import express from 'express';
import mysql from 'mysql2/promise';
import fetch from 'node-fetch';
import bcrypt from "bcrypt";
import session from 'express-session';
import pkg from "pg";

const { Pool } = pkg;

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

const conn = new Pool({
  user: "postgres.vgrkuwvymsgdavyvhpoq",
  host: "aws-1-us-west-1.pooler.supabase.com",
  database: "postgres",
  password: "ColtonDatabasePassword1",
  port: 6543,
});
// const conn = await pool.getConnection();
conn.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL");
    client.release();
  })
  .catch(err => console.error("❌ Database connection error:", err.stack));

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
    let getLikesSql = 'SELECT likes FROM Posts WHERE postid = $1';
    let sqlParamsLike = [postId];
    const likeTable = await conn.query(getLikesSql, sqlParamsLike);
    const likesTable = likeTable.rows;
    let sql = 'UPDATE Posts SET likes = $1 WHERE postid = $2';
    let sqlParams = [likesTable[0].likes + 1, postId]
    const row = await conn.query(sql, sqlParams);
    const rows = row.rows;
    res.redirect('/posts');
});

app.post('/likeComment', async (req, res) => {
    const { commentId } = req.body;
    let getLikesSql = 'SELECT likes FROM Comments WHERE commentid = $1';
    let sqlParamsLike = [commentId];
    const likeTable = await conn.query(getLikesSql, sqlParamsLike);
    const likesTable = likeTable.rows;
    let sql = 'UPDATE Comments SET likes = $1 WHERE commentid = $2';
    let sqlParams = [likesTable[0].likes + 1, commentId]
    const row = await conn.query(sql, sqlParams);
    const rows = row.rows;
    res.redirect('/posts');
});


app.post('/comment', async (req, res) => {
    const { postId } = req.body;
    const { commentContent } = req.body;
    let currentDate = new Date();
    let formattedDate = currentDate.toISOString().split('T')[0];
    let sql = 'INSERT INTO Comments (text, likes, userid, postid, dateposted) VALUES ($1, $2, $3, $4, $5)';
    let sqlParams = [commentContent, 0, req.session.user.id, postId, formattedDate];
    const row = await conn.query(sql, sqlParams);
    const rows = row.rows;
    res.redirect('/posts');
});

app.get('/posts', isAuthenticated, async (req, res) => {
    console.log("Hello: " + req.session.user.id);
    let keyword = req.query.keyword || '';
    let sql = 'SELECT * FROM Posts NATURAL JOIN users WHERE username LIKE $1 ORDER BY postid DESC';
    let postSearch = [`%${keyword}%`];
    const drinks = await fetchCocktails();
    const post = await conn.query(sql, postSearch);
    const posts = post.rows;
    let UserSql = `SELECT * FROM users WHERE userid = $1`;
    let sqlParams = [req.session.user.id];
    const users = await conn.query(UserSql, sqlParams);
    const user = users.rows;
    let sqlComments = 'SELECT * FROM Comments NATURAL JOIN users';
    const comment = await conn.query(sqlComments);
    const comments = comment.rows;
    console.log(posts);
    res.render('posts', { posts, drinks, user: req.session.user.id, comments});
});

app.post('/posts', async (req, res) => {
    console.log("Hello: " + req.session.user.id);
    let drink = req.body.drinkList;
    let caption = req.body.caption;
    let content = `Drink: ${drink}`; 
    let cocktail = await fetchCocktailDetails(drink);
    let currentDate = new Date();
    let formattedDate = currentDate.toISOString().split('T')[0];
    let sql = 'INSERT INTO Posts (userid, content, caption, likes, image, instructions, dateposted) VALUES ($1, $2, $3, $4, $5, $6, $7)';
    let sqlParams = [req.session.user.id, content, caption, 0, cocktail.strDrinkThumb, cocktail.strInstructions, formattedDate];

    let sqlUpdate = 'UPDATE users SET postcount = postcount + 1 WHERE userid = $1';
    let sqlParamsUpdate = [req.session.user.id];
    const updates = await conn.query(sqlUpdate, sqlParamsUpdate);
    const update = updates.rows;
    const post = await conn.query(sql, sqlParams);
    const posts = post.rows;
    res.redirect('/posts');
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.render('login.ejs')
 });

app.get('/profile', isAuthenticated, async (req, res) => {
    let sql = `SELECT * FROM Posts NATURAL JOIN users WHERE userid = $1 ORDER BY postid DESC`
    let sqlParams = [req.session.user.id];
    const post = await conn.query(sql, sqlParams);
    const posts = post.rows;

    let sqlComments = 'SELECT * FROM Comments NATURAL JOIN users';
    const results = await conn.query(sqlComments);
    const comments = results.rows;
    
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
               SET firstname = $1,
               lastname = $2,
               username = $3
               WHERE userid = $4`;
    let sqlParams = [firstName, lastName, username, userId];
    const results = await conn.query(sql, sqlParams);
    const userData = results.rows;
    res.redirect('/profile');
});

app.get('/profile/deletePost', isAuthenticated, async (req, res) => {
    let postId = req.query.postId;
    let sql = `DELETE FROM Posts WHERE postid = $1`;
    const results = await conn.query(sql, [postId]);
    const rows = results.rows;

    res.redirect('/profile');
});

app.get('/comment/delete', isAuthenticated, async (req, res) => {
    let commentId = req.query.commentId;
    console.log(commentId);
    let sql = `DELETE FROM Comments WHERE commentid = $1`;
    const results = await conn.query(sql, [commentId]);
    const rows = results.rows;

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
                   WHERE username = $1`;
    let userParams = [username];
    const results = await conn.query(userSql, userParams);
    const unique = results.rows;
    if (unique.length > 0) {
        return res.status(400).send('Username already taken.');
    }
    
    let saltRounds = 10;
    let hashedPassword = await bcrypt.hash(password, saltRounds);

    let pfpURL = `https://robohash.org/${username}.png?set=set4`;

    let sql = `INSERT INTO users 
               (firstname, 
                lastname, 
                username, 
                password,
                profilepicture) 
                VALUES($1, $2, $3, $4, $5)`;
    let sqlParams = [fName, lName, username, hashedPassword, pfpURL];
            
    await conn.query(sql, sqlParams);
    res.render('login.ejs')
});

app.post('/login', async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    let sql = `SELECT * 
    FROM users
    WHERE username = $1`;
    let sqlParams = [username];
    const results = await conn.query(sql, sqlParams);
    const rows = results.rows;

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
            id: rows[0].userid,
            username: rows[0].username,
            firstName: rows[0].firstname,
            lastName: rows[0].lastname,
            pfp: rows[0].profilepicture
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