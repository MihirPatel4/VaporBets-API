import db from '../config/db.js';

export async function up() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id),
      currency VARCHAR(20) NOT NULL,
      amount INTEGER NOT NULL CHECK (amount <> 0),
      reason VARCHAR(50) NOT NULL,
      related_bet_id UUID REFERENCES bets(id),
      grant_week DATE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  //unique index prevents duplicate grants
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_weekly_grant_unique
    ON ledger_entries (user_id, currency, grant_week)
    WHERE grant_week IS NOT NULL
  `);
}

export async function down() {
  await db.query('DROP TABLE IF EXISTS ledger_entries');
}

