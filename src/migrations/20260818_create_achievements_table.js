import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS achievements (
      id UUID PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      rarity rarity NOT NULL,
      points_awarded INTEGER NOT NULL CHECK (points_awarded >= 0),
      criteria TEXT NOT NULL
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS achievements');
}

