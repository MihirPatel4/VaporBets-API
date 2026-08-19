import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_outcomes (
      id UUID PRIMARY KEY,
      market_id UUID NOT NULL REFERENCES markets(id),
      label VARCHAR(200) NOT NULL,
      odds NUMERIC(12, 4) NOT NULL CHECK (odds > 0),
      probability NUMERIC(7, 6) NOT NULL CHECK (probability >= 0 AND probability <= 1),
      result outcome_result NOT NULL DEFAULT 'PENDING',
      UNIQUE (market_id, label)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS market_outcomes');
}

