const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'skyrden.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Users table (already exists)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE,
        roblox_id TEXT,
        discord_username TEXT,
        roblox_username TEXT,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Remove old applications table if it exists (replaced by application_responses)
    db.run(`DROP TABLE IF EXISTS applications`);

    // Application forms table with all new columns
    db.run(`CREATE TABLE IF NOT EXISTS application_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        fields TEXT NOT NULL,
        options TEXT,
        deadline DATETIME,
        application_limit INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // Application responses table
    db.run(`CREATE TABLE IF NOT EXISTS application_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_form_id INTEGER,
        user_id INTEGER,
        responses TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_feedback TEXT,
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notification_sent BOOLEAN DEFAULT 0,
        notification_sent_at DATETIME,
        FOREIGN KEY (application_form_id) REFERENCES application_forms (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (reviewed_by) REFERENCES users (id)
    )`);

    // Admin whitelist table
    db.run(`CREATE TABLE IF NOT EXISTS admin_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('Database tables initialized');
});

// Function to add column only if it doesn't exist (safe method)
function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    // Check if column exists by trying to select it
    db.get(
        `SELECT ${columnName} FROM ${tableName} LIMIT 1`,
        (err) => {
            if (err && err.message.includes('no such column')) {
                // Column doesn't exist, so add it
                db.run(
                    `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
                    (err) => {
                        if (err) {
                            console.error(`Error adding column ${columnName} to ${tableName}:`, err);
                        } else {
                            console.log(`✓ Added column ${columnName} to ${tableName}`);
                        }
                    }
                );
            } else if (err) {
                console.error(`Error checking column ${columnName} in ${tableName}:`, err);
            } else {
                console.log(`✓ Column ${columnName} already exists in ${tableName}`);
            }
        }
    );
}

// Add new columns safely after table creation
setTimeout(() => {
    addColumnIfNotExists('application_responses', 'notification_sent', 'BOOLEAN DEFAULT 0');
    addColumnIfNotExists('application_responses', 'notification_sent_at', 'DATETIME');
}, 1000);

module.exports = db;