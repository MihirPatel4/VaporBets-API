import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_achievements (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      achievement_id UUID NOT NULL REFERENCES achievements(id),
      earned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      related_bet_id UUID REFERENCES bets(id),
      event_id UUID REFERENCES events(id),
      UNIQUE (user_id, achievement_id)
    )
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS user_achievements');
}

