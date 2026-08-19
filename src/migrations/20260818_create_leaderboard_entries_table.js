import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id UUID PRIMARY KEY,
      leaderboard_id UUID NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      points INTEGER NOT NULL DEFAULT 0,
      rank INTEGER NOT NULL CHECK (rank > 0),
      UNIQUE (leaderboard_id, user_id),
      UNIQUE (leaderboard_id, rank)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS leaderboard_entries');
}

