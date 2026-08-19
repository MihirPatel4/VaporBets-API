import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS markets (
      id UUID PRIMARY KEY,
      event_id UUID NOT NULL REFERENCES events(id),
      question VARCHAR(500) NOT NULL,
      type market_type NOT NULL,
      status market_status NOT NULL DEFAULT 'OPEN',
      closes_at TIMESTAMP NOT NULL
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS markets');
}

