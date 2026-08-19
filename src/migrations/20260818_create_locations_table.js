import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id),
      country VARCHAR(100) NOT NULL,
      region VARCHAR(100) NOT NULL,
      consent_given BOOLEAN NOT NULL DEFAULT FALSE,
      shared_at TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS locations');
}

