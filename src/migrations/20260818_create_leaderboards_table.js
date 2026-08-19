import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leaderboards (
      id UUID PRIMARY KEY,
      scope leaderboard_scope NOT NULL,
      scope_key VARCHAR(100),
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      CHECK (period_end > period_start),
      UNIQUE (scope, scope_key, period_start, period_end)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS leaderboards');
}

