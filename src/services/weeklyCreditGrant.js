import db from '../config/db.js';
import { WEEKLY_VAPORCREDITS } from '../config/vaporcredits.js';

//get the date of the sunday that starts the current week
export function getCurrentUtcWeekStart() {
  const sunday = new Date();
  sunday.setUTCHours(0, 0, 0, 0);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  //format to YYYY-MM-DD
  return sunday.toISOString().slice(0, 10);
}

export async function grantWeeklyCredits(weekStart) {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== weekStart ||
      date.getUTCDay() !== 0) {
    throw new Error('weekStart must be a valid Sunday in YYYY-MM-DD format');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    //create new wallet if one does not exist
    await client.query(`
      INSERT INTO vaporcredits_wallets (id, user_id, balance)
      SELECT gen_random_uuid(), id, 0
      FROM users
      ON CONFLICT (user_id) DO NOTHING
    `);

    const { rows } = await client.query(`
      WITH new_grants AS (
        INSERT INTO ledger_entries (id, user_id, currency, amount, reason, grant_week)
        SELECT gen_random_uuid(), user_id, 'VAPORCREDITS', $2, 'WEEKLY_ALLOWANCE', $1::date
        FROM vaporcredits_wallets
        ON CONFLICT (user_id, currency, grant_week) WHERE grant_week IS NOT NULL
        DO NOTHING
        RETURNING user_id, amount
      )
      UPDATE vaporcredits_wallets AS wallet
      SET balance = wallet.balance + new_grants.amount, updated_at = CURRENT_TIMESTAMP
      FROM new_grants
      WHERE wallet.user_id = new_grants.user_id
      RETURNING wallet.user_id
    `, [weekStart, WEEKLY_VAPORCREDITS]);

    await client.query('COMMIT');
    return rows.length;
  }
  catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  finally {
    client.release();
  }
}