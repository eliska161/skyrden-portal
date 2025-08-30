// filepath: server/database/db.js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL, // Add this to your .env
  ssl: { rejectUnauthorized: false }
});
module.exports = pool;