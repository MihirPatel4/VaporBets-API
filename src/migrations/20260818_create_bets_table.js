import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bets (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      amount_wagered NUMERIC(12, 2) NOT NULL CHECK (amount_wagered > 0),
      combined_odds NUMERIC(12, 4) NOT NULL CHECK (combined_odds > 0),
      potential_payout NUMERIC(12, 2) NOT NULL CHECK (potential_payout >= 0),
      status bet_status NOT NULL DEFAULT 'PENDING',
      placed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      settled_at TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS bets');
}

