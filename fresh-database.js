const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database', 'skyrden.db');

// Backup old database first
if (fs.existsSync(dbPath)) {
    const backupPath = dbPath + '.backup-' + Date.now();
    fs.copyFileSync(dbPath, backupPath);
    console.log('📦 Old database backed up to:', backupPath);
}

// Delete old database
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Old database deleted');
}

const db = new sqlite3.Database(dbPath);

console.log('🚀 Creating fresh database...');

// Complete schema creation
const schema = [
    // Users table
    `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE,
        roblox_id TEXT,
        roblox_username TEXT,
        discord_username TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Admin whitelist
    `CREATE TABLE admin_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Application forms (with created_by column)
    `CREATE TABLE application_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        fields TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`,
    
    // Application responses
    `CREATE TABLE application_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_form_id INTEGER,
        user_id INTEGER,
        responses TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        admin_feedback TEXT,
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_form_id) REFERENCES application_forms (id),
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (reviewed_by) REFERENCES users (id)
    )`
];

schema.forEach((sql, index) => {
    db.run(sql, (err) => {
        if (err) {
            console.error(`❌ Error creating table ${index + 1}:`, err);
        } else {
            console.log(`✅ Table ${index + 1} created successfully`);
        }
    });
});

// Add yourself to admin whitelist
setTimeout(() => {
    const YOUR_DISCORD_ID = '633719461'; // Your Discord ID
    
    db.run(
        'INSERT INTO admin_whitelist (discord_id) VALUES (?)',
        [YOUR_DISCORD_ID],
        function(err) {
            if (err) {
                console.error('❌ Error adding to whitelist:', err);
            } else {
                console.log('✅ Added to admin whitelist');
            }
            
            // Verify all tables
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    console.error('❌ Error reading tables:', err);
                } else {
                    console.log('\n📋 Database tables created:');
                    tables.forEach(table => console.log(`   - ${table.name}`));
                }
                
                db.close();
                console.log('\n✨ Fresh database created! Restart your server.');
            });
        }
    );
}, 1000);