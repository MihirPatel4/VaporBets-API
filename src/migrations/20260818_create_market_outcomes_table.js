import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_outcomes (
      id UUID PRIMARY KEY,
      market_id UUID NOT NULL REFERENCES markets(id),
      label VARCHAR(200) NOT NULL,
      odds NUMERIC(12, 4) NOT NULL CHECK (odds > 0),
      probability NUMERIC(7, 6) NOT NULL CHECK (probability >= 0 AND probability <= 1),
      polymarket_token_id VARCHAR(150) UNIQUE,
      polymarket_price NUMERIC(10, 8) CHECK (polymarket_price >= 0 AND polymarket_price <= 1),
      baseline_probability NUMERIC(7, 6) CHECK (baseline_probability >= 0 AND baseline_probability <= 1),
      baseline_odds NUMERIC(12, 4) CHECK (baseline_odds > 0),
      best_bid NUMERIC(10, 8) CHECK (best_bid >= 0 AND best_bid <= 1),
      best_ask NUMERIC(10, 8) CHECK (best_ask >= 0 AND best_ask <= 1),
      last_trade_price NUMERIC(10, 8) CHECK (last_trade_price >= 0 AND last_trade_price <= 1),
      price_updated_at TIMESTAMP,
      result outcome_result NOT NULL DEFAULT 'PENDING',
      UNIQUE (market_id, label)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS market_outcomes');
}

