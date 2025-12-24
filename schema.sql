CREATE DATABASE IF NOT EXISTS daily_plan_db;
USE daily_plan_db;
CREATE TABLE IF NOT EXISTS todos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text VARCHAR(255) NOT NULL,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    completed BOOLEAN DEFAULT FALSE,
    created_at VARCHAR(20) -- Store date string YYYY-MM-DD
);
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(50),
    description VARCHAR(255),
    amount DECIMAL(10, 2) NOT NULL,
    created_at VARCHAR(20) -- Store date string YYYY-MM-DD
);