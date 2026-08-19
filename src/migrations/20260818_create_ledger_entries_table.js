import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      currency VARCHAR(20) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
      reason VARCHAR(50) NOT NULL,
      related_bet_id UUID REFERENCES bets(id),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS ledger_entries');
}

