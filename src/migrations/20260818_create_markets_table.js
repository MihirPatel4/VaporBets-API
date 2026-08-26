import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS markets (
      id UUID PRIMARY KEY,
      event_id UUID NOT NULL REFERENCES events(id),
      polymarket_id VARCHAR(100) UNIQUE NOT NULL,
      question VARCHAR(500) NOT NULL,
      slug VARCHAR(300),
      condition_id VARCHAR(100),
      type market_type NOT NULL,
      status market_status NOT NULL DEFAULT 'OPEN',
      closes_at TIMESTAMP,
      source_updated_at TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS markets');
}

