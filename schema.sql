CREATE DATABASE IF NOT EXISTS daily_plan_db;
USE daily_plan_db;
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 计划表 (添加 user_id)
CREATE TABLE IF NOT EXISTS todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT 1,
    text VARCHAR(255) NOT NULL,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    completed BOOLEAN DEFAULT FALSE,
    created_at VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- 交易表 (添加 user_id)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT 1,
    type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(50),
    description VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    created_at VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- 插入默认用户
INSERT IGNORE INTO users (id, username)
VALUES (1, '默认用户');