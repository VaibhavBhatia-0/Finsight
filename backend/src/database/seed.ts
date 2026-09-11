import fs from 'fs';
import path from 'path';
import { getDatabaseClient, IDatabaseClient } from './db';

export async function runSeeds(client?: IDatabaseClient): Promise<string[]> {
  const dbClient = client || getDatabaseClient();
  console.log(`[Seed] Running seeds using driver: ${dbClient.getDriverName()}`);

  const seedsDir = path.resolve(__dirname, '../../../database/seeds');
  if (!fs.existsSync(seedsDir)) {
    throw new Error(`Seeds directory not found: ${seedsDir}`);
  }

  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const appliedSeeds: string[] = [];

  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS schema_seeds (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const file of files) {
    const existing = await dbClient.query('SELECT id FROM schema_seeds WHERE filename = $1', [file]);
    if (existing.rows.length > 0) {
      console.log(`[Seed] Already applied: ${file}`);
      continue;
    }
    console.log(`[Seed] Applying seed: ${file}...`);
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    await dbClient.transaction(async executor => {
      await executor.exec(sql);
      await executor.query('INSERT INTO schema_seeds (filename) VALUES ($1)', [file]);
    });
    appliedSeeds.push(file);
    console.log(`[Seed] Successfully applied seed: ${file}`);
  }

  console.log(`[Seed] Finished. ${appliedSeeds.length} seed file(s) executed.`);
  return appliedSeeds;
}

if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('[Seed] Seeding process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Seeding failed:', err);
      process.exit(1);
    });
}
