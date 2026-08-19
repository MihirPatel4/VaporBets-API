import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY,
      category_id UUID NOT NULL REFERENCES market_categories(id),
      title VARCHAR(200) NOT NULL,
      description TEXT,
      start_time TIMESTAMP NOT NULL,
      status event_status NOT NULL DEFAULT 'UPCOMING'
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS events');
}

