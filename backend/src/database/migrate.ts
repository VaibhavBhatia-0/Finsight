import fs from 'fs';
import path from 'path';
import { getDatabaseClient, IDatabaseClient } from './db';

export async function runMigrations(client?: IDatabaseClient): Promise<string[]> {
  const dbClient = client || getDatabaseClient();
  console.log(`[Migration] Running migrations using driver: ${dbClient.getDriverName()}`);

  // Create schema_migrations table if not exists
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../../../database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedMigrations: string[] = [];

  for (const file of files) {
    const check = await dbClient.query(
      'SELECT id FROM schema_migrations WHERE filename = $1',
      [file]
    );

    if (check.rows.length === 0) {
      console.log(`[Migration] Applying: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await dbClient.transaction(async executor => {
        await executor.exec(sql);
        await executor.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      });

      appliedMigrations.push(file);
      console.log(`[Migration] Successfully applied: ${file}`);
    } else {
      console.log(`[Migration] Already applied: ${file}`);
    }
  }

  console.log(`[Migration] Finished. ${appliedMigrations.length} new migration(s) applied.`);
  return appliedMigrations;
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[Migration] Migration process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Migration failed:', err);
      process.exit(1);
    });
}
