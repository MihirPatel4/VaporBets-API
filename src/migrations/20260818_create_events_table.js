import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY,
      polymarket_id VARCHAR(100) UNIQUE NOT NULL,
      category_id UUID NOT NULL REFERENCES market_categories(id),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      slug VARCHAR(300),
      game_id BIGINT,
      start_time TIMESTAMP,
      status event_status NOT NULL DEFAULT 'UPCOMING',
      source_updated_at TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS events');
}

