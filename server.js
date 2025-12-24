const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Database Connection - 支持本地和云端环境
// Railway 使用 MYSQLHOST 格式，标准格式是 MYSQL_HOST，两者都支持
const db = mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || 'tyl20040923.',
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || undefined,
    port: process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
    multipleStatements: true
});

// Connect and Setup Database
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL server.');

    // 云端环境：数据库已由Railway创建，只需建表
    if (process.env.MYSQLHOST || process.env.MYSQL_HOST) {
        const createTables = `
            CREATE TABLE IF NOT EXISTS todos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                text VARCHAR(255) NOT NULL,
                start_time VARCHAR(10),
                end_time VARCHAR(10),
                completed BOOLEAN DEFAULT FALSE,
                created_at VARCHAR(20)
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('income', 'expense') NOT NULL,
                category VARCHAR(50),
                description VARCHAR(255),
                amount DECIMAL(10, 2) NOT NULL,
                created_at VARCHAR(20)
            );
        `;
        db.query(createTables, (err) => {
            if (err) console.error('Error creating tables:', err);
            else console.log('Tables ready.');
        });
    } else {
        // 本地环境：创建数据库和表
        const fs = require('fs');
        const schema = fs.readFileSync('schema.sql', 'utf8');
        db.query(schema, (err, results) => {
            if (err) {
                console.error('Error initializing database:', err);
                return;
            }
            console.log('Database initialized.');
            db.changeUser({ database: 'daily_plan_db' }, (err) => {
                if (err) console.error('Error selecting database:', err);
            });
        });
    }
});

// --- API Endpoints ---

// Get all data for a specific date
app.get('/api/data', (req, res) => {
    const date = req.query.date; // YYYY-MM-DD
    if (!date) return res.status(400).send('Date required');

    const sqlTodos = 'SELECT * FROM todos WHERE created_at = ? ORDER BY start_time';
    const sqlTrans = 'SELECT * FROM transactions WHERE created_at = ?';

    db.query(sqlTodos, [date], (err, todos) => {
        if (err) return res.status(500).send(err);

        db.query(sqlTrans, [date], (err, transactions) => {
            if (err) return res.status(500).send(err);

            // Format for frontend
            const formattedTodos = todos.map(t => ({
                id: t.id,
                text: t.text,
                start: t.start_time,
                end: t.end_time,
                completed: !!t.completed
            }));

            const formattedTrans = transactions.map(t => ({
                id: t.id,
                type: t.type,
                category: t.category,
                desc: t.description,
                amount: Number(t.amount)
            }));

            res.json({ todos: formattedTodos, transactions: formattedTrans });
        });
    });
});

// Add Todo
app.post('/api/todos', (req, res) => {
    const { text, start, end, date } = req.body;
    const sql = 'INSERT INTO todos (text, start_time, end_time, created_at) VALUES (?, ?, ?, ?)';
    db.query(sql, [text, start, end, date], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});

// Toggle Todo
app.put('/api/todos/:id/toggle', (req, res) => {
    const sql = 'UPDATE todos SET completed = NOT completed WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// Delete Todo
app.delete('/api/todos/:id', (req, res) => {
    const sql = 'DELETE FROM todos WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// Add Transaction
app.post('/api/transactions', (req, res) => {
    const { type, category, desc, amount, date } = req.body;
    const sql = 'INSERT INTO transactions (type, category, description, amount, created_at) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [type, category, desc, amount, date], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json({ id: result.insertId });
    });
});

// Delete Transaction
app.delete('/api/transactions/:id', (req, res) => {
    const sql = 'DELETE FROM transactions WHERE id = ?';
    db.query(sql, [req.params.id], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// Stats
app.get('/api/stats', (req, res) => {
    const year = req.query.year;
    // Simple implementation: fetch all transactions for the year
    // Note: 'created_at' is stored as string 'YYYY-MM-DD'
    const sql = 'SELECT * FROM transactions WHERE created_at LIKE ?';
    db.query(sql, [`${year}%`], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
