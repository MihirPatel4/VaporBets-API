import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      parent_category_id UUID REFERENCES market_categories(id),
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS market_categories');
}

