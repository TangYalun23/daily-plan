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
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            INSERT IGNORE INTO users (id, username) VALUES (1, '默认用户');
            CREATE TABLE IF NOT EXISTS todos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT 1,
                text VARCHAR(255) NOT NULL,
                start_time VARCHAR(10),
                end_time VARCHAR(10),
                completed BOOLEAN DEFAULT FALSE,
                created_at VARCHAR(20)
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT 1,
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

// === 用户管理 API ===

// 获取所有用户
app.get('/api/users', (req, res) => {
    db.query('SELECT id, username, created_at FROM users ORDER BY id', (err, users) => {
        if (err) return res.status(500).send(err);
        res.json(users);
    });
});

// 添加用户
app.post('/api/users', (req, res) => {
    const { username } = req.body;
    if (!username || !username.trim()) return res.status(400).send('用户名不能为空');

    db.query('INSERT INTO users (username) VALUES (?)', [username.trim()], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).send('用户名已存在');
            return res.status(500).send(err);
        }
        res.json({ id: result.insertId, username: username.trim() });
    });
});

// 删除用户
app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    if (userId === '1') return res.status(400).send('默认用户不能删除');

    db.query('DELETE FROM users WHERE id = ?', [userId], (err) => {
        if (err) return res.status(500).send(err);
        res.sendStatus(200);
    });
});

// === 数据 API (支持用户过滤) ===

// Get all data for a specific date
app.get('/api/data', (req, res) => {
    const date = req.query.date; // YYYY-MM-DD
    const userId = req.query.userId || 1;
    if (!date) return res.status(400).send('Date required');

    const sqlTodos = 'SELECT * FROM todos WHERE created_at = ? AND user_id = ? ORDER BY start_time';
    const sqlTrans = 'SELECT * FROM transactions WHERE created_at = ? AND user_id = ?';

    db.query(sqlTodos, [date, userId], (err, todos) => {
        if (err) return res.status(500).send(err);

        db.query(sqlTrans, [date, userId], (err, transactions) => {
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
    const { text, start, end, date, userId } = req.body;
    const sql = 'INSERT INTO todos (user_id, text, start_time, end_time, created_at) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [userId || 1, text, start, end, date], (err, result) => {
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
    const { type, category, desc, amount, date, userId } = req.body;
    const sql = 'INSERT INTO transactions (user_id, type, category, description, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [userId || 1, type, category, desc, amount, date], (err, result) => {
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
    const userId = req.query.userId || 1;
    const sql = 'SELECT * FROM transactions WHERE created_at LIKE ? AND user_id = ?';
    db.query(sql, [`${year}%`, userId], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

// 分类统计 API
app.get('/api/category-stats', (req, res) => {
    const { year, month, userId } = req.query;
    const uid = userId || 1;

    let datePattern = `${year}%`;
    if (month) {
        datePattern = `${year}-${month.padStart(2, '0')}%`;
    }

    const sql = `
        SELECT type, category, SUM(amount) as total, COUNT(*) as count
        FROM transactions 
        WHERE created_at LIKE ? AND user_id = ?
        GROUP BY type, category
        ORDER BY type, total DESC
    `;

    db.query(sql, [datePattern, uid], (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});


// Export CSV
app.get('/api/export', (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const uid = userId || 1;

    const todosSql = 'SELECT * FROM todos WHERE created_at >= ? AND created_at <= ? AND user_id = ? ORDER BY created_at';
    const transSql = 'SELECT * FROM transactions WHERE created_at >= ? AND created_at <= ? AND user_id = ? ORDER BY created_at';

    db.query(todosSql, [startDate, endDate, uid], (err, todos) => {
        if (err) return res.status(500).send(err);

        db.query(transSql, [startDate, endDate, uid], (err, transactions) => {
            if (err) return res.status(500).send(err);

            // Generate CSV content
            let csv = '类型,日期,内容,金额/时间,状态\n';

            todos.forEach(t => {
                csv += `计划,${t.created_at},"${t.text}",${t.start_time}-${t.end_time},${t.completed ? '已完成' : '未完成'}\n`;
            });

            transactions.forEach(t => {
                csv += `${t.type === 'income' ? '收入' : '支出'},${t.created_at},"${t.category}: ${t.description}",¥${t.amount},--\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=daily-plan-${startDate}-${endDate}.csv`);
            res.send('\ufeff' + csv); // BOM for Excel
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
