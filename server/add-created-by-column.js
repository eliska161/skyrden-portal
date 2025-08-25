const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'skyrden.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Adding created_by column to application_forms table...');

// Method 1: Try to add the column directly
db.run('ALTER TABLE application_forms ADD COLUMN created_by INTEGER', function(err) {
    if (err) {
        console.log('❌ Could not add column directly:', err.message);
        console.log('🔄 Trying alternative method...');
        useAlternativeMethod();
    } else {
        console.log('✅ Successfully added created_by column!');
        
        // Also add updated_at column if it doesn't exist
        db.run('ALTER TABLE application_forms ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP', function(err) {
            if (err && !err.message.includes('duplicate column name')) {
                console.log('❌ Could not add updated_at column:', err.message);
            } else {
                console.log('✅ Updated_at column added or already exists');
            }
            
            verifyTableStructure();
        });
    }
});

function useAlternativeMethod() {
    // SQLite has limited ALTER TABLE support, so we need to recreate the table
    console.log('🔄 Recreating application_forms table with correct schema...');
    
    const steps = [
        // Create temporary table with correct schema
        `CREATE TABLE application_forms_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            fields TEXT NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Copy data from old table to new table
        `INSERT INTO application_forms_new (id, title, description, fields, is_active, created_at)
         SELECT id, title, description, fields, is_active, created_at FROM application_forms`,
        
        // Drop old table
        `DROP TABLE application_forms`,
        
        // Rename new table to original name
        `ALTER TABLE application_forms_new RENAME TO application_forms`
    ];
    
    // Execute each step
    let currentStep = 0;
    
    function executeNextStep() {
        if (currentStep >= steps.length) {
            verifyTableStructure();
            return;
        }
        
        const sql = steps[currentStep];
        console.log(`   Step ${currentStep + 1}/${steps.length}: ${sql.split(' ')[0]}...`);
        
        db.run(sql, function(err) {
            if (err) {
                console.error(`❌ Error in step ${currentStep + 1}:`, err.message);
            } else {
                console.log(`✅ Step ${currentStep + 1} completed`);
            }
            
            currentStep++;
            setTimeout(executeNextStep, 100);
        });
    }
    
    executeNextStep();
}

function verifyTableStructure() {
    console.log('\n🔍 Verifying table structure...');
    
    db.all("PRAGMA table_info(application_forms)", (err, columns) => {
        if (err) {
            console.error('❌ Error reading table info:', err);
        } else {
            console.log('📋 application_forms table columns:');
            columns.forEach(col => {
                console.log(`   - ${col.name} (${col.type})`);
            });
            
            // Check if created_by column exists
            const hasCreatedBy = columns.some(col => col.name === 'created_by');
            const hasUpdatedAt = columns.some(col => col.name === 'updated_at');
            
            console.log(`\n✅ created_by column: ${hasCreatedBy ? 'PRESENT' : 'MISSING'}`);
            console.log(`✅ updated_at column: ${hasUpdatedAt ? 'PRESENT' : 'MISSING'}`);
            
            if (hasCreatedBy && hasUpdatedAt) {
                console.log('\n🎉 Database schema is now correct!');
            } else {
                console.log('\n❌ Still missing required columns. Try the nuclear option.');
            }
        }
        
        db.close();
    });
}

// Handle process exit
process.on('exit', () => {
    console.log('\n✨ Please restart your server after fixing the database.');
});