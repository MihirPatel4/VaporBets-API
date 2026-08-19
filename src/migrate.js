import db from './config/db.js';

const migrationFiles = [
  '20260818_create_enum_types.js',
  '20260818_create_users_table.js',
  '20260818_create_locations_table.js',
  '20260818_create_wallets_table.js',
  '20260818_create_market_categories_table.js',
  '20260818_create_events_table.js',
  '20260818_create_markets_table.js',
  '20260818_create_market_outcomes_table.js',
  '20260818_create_achievements_table.js',
  '20260818_create_bets_table.js',
  '20260818_create_bet_legs_table.js',
  '20260818_create_ledger_entries_table.js',
  '20260818_create_user_achievements_table.js',
  '20260818_create_leaderboards_table.js',
  '20260818_create_leaderboard_entries_table.js',
];

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function runMigrations() {
  await ensureMigrationsTable();

  const { rows } = await db.query(
    'SELECT name FROM migrations ORDER BY id',
  );
  const completedMigrations = new Set(rows.map((row) => row.name));

  for (const file of migrationFiles) {
    if (completedMigrations.has(file)) {
      console.log(`Skipping ${file}`);
      continue;
    }

    console.log(`Running ${file}`);
    const migration = await import(`./migrations/${file}`);

    await migration.up();
    await db.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [file],
    );
    console.log(`Completed ${file}`);
  }
}

try {
  await runMigrations();
  console.log('Migrations completed.');
} 
catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} 
finally {
  await db.end();
}