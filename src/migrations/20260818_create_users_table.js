import db from '../config/db.js'

export async function up() {
  await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255),
        is_premium BOOLEAN DEFAULT FALSE,
        current_login_streak INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        email_verified_at TIMESTAMP,
        total_points INTEGER DEFAULT 0
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS users');
}