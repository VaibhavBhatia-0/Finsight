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

  for (const file of files) {
    console.log(`[Seed] Applying seed: ${file}...`);
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    await dbClient.exec(sql);
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
