// update-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database', 'skyrden.db');
const db = new sqlite3.Database(dbPath);

console.log('Updating database schema...');

db.serialize(() => {
    // Add new columns to application_forms table
    db.run(`ALTER TABLE application_forms ADD COLUMN options TEXT`);
    db.run(`ALTER TABLE application_forms ADD COLUMN deadline DATETIME`);
    db.run(`ALTER TABLE application_forms ADD COLUMN application_limit INTEGER DEFAULT 1`);
    
    console.log('Database schema updated successfully!');
});

db.close();