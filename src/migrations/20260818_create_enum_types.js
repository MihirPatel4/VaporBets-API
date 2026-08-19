import db from '../config/db.js';

export async function up() {
  await db.query(`
    DO $$ BEGIN
      CREATE TYPE bet_status AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE event_status AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE market_type AS ENUM ('SINGLE', 'MULTIPLE');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE market_status AS ENUM ('OPEN', 'CLOSED', 'SETTLED', 'CANCELLED');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE outcome_result AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE rarity AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE TYPE leaderboard_scope AS ENUM ('REGIONAL', 'COUNTRY', 'WORLDWIDE');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

export async function down() {
  await db.query(`
    DROP TYPE IF EXISTS leaderboard_scope;
    DROP TYPE IF EXISTS rarity;
    DROP TYPE IF EXISTS outcome_result;
    DROP TYPE IF EXISTS market_status;
    DROP TYPE IF EXISTS market_type;
    DROP TYPE IF EXISTS event_status;
    DROP TYPE IF EXISTS bet_status;
  `);
}

