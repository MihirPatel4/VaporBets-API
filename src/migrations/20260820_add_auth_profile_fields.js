import db from '../config/db.js';

export async function up() {
  await db.query(`
    ALTER TABLE users
      ALTER COLUMN password_hash TYPE VARCHAR(255),
      ALTER COLUMN password_hash DROP NOT NULL,
      ALTER COLUMN is_premium SET DEFAULT FALSE,
      ALTER COLUMN current_login_streak SET DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
      ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

    CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique
      ON users (phone_number)
      WHERE phone_number IS NOT NULL;
  `);
}

export async function down() {
  await db.query(`
    DROP INDEX IF EXISTS users_phone_number_unique;
    ALTER TABLE users
      DROP COLUMN IF EXISTS phone_verified_at,
      DROP COLUMN IF EXISTS email_verified_at,
      DROP COLUMN IF EXISTS phone_number;
  `);
}