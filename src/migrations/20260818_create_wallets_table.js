import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS vapor_credits_wallets (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL UNIQUE REFERENCES users(id),
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS vapor_credits_wallets');
}

