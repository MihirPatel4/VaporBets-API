import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bet_legs (
      id UUID PRIMARY KEY,
      bet_id UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
      market_outcome_id UUID NOT NULL REFERENCES market_outcomes(id),
      odds_at_placement NUMERIC(12, 4) NOT NULL CHECK (odds_at_placement > 0),
      UNIQUE (bet_id, market_outcome_id)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS bet_legs');
}

