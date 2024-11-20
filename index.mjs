import express from 'express';
import mysql from 'mysql2/promise';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

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
    res.render('welcome');
});

app.get('/find', (req, res) => {
    res.render('find');
});

app.get('/posts', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const [posts] = await conn.query('SELECT * FROM posts ORDER BY posts.postId DESC');
        console.log('Posts from database:', posts); // Add this line
        const drinks = await fetchCocktails();
        res.render('posts', { posts, drinks });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    } finally {
        conn.release();
    }
});

app.post('/posts', async (req, res) => {
    const { username, drinkList, comment } = req.body;
    const conn = await pool.getConnection();
    try {
        // Format drinks list into content
        const drinks = Array.isArray(drinkList) ? drinkList.join(', ') : (drinkList || '');
        const content = `${comment || ''}\n\nDrinks: ${drinks}`;
        
        await conn.query(
            'INSERT INTO posts (userId, title, content, likesCount) VALUES (?, ?, ?, ?)',
            [1, username, content, 0] // Using userId=1 as default, adjust as needed
        );
        res.redirect('/posts');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating post');
    } finally {
        conn.release();
    }
});

app.get('/costs', (req, res) => {
    res.render('costs');
});

app.get('/auth', (req, res) => {
    res.render('auth');
});

app.listen(3101, ()=>{
    console.log("Express server running")
})