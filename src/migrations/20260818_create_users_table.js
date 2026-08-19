import db from '../config/db.js'

export async function up() {
  await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) NOT NULL,
        password_hash VARCHAR(50) NOT NULL,
        is_premium BOOLEAN NOT NULL,
        current_login_streak INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        total_points INTEGER DEFAULT 0
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS users');
}

