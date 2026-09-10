import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createApp } from './app';
import { runMigrations } from './database/migrate';
import { runSeeds } from './database/seed';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[FinSight] Initializing database...');
    await runMigrations();
    await runSeeds();

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`[FinSight API] Server running on port ${PORT} at http://localhost:${PORT}`);
      console.log(`[FinSight API] Health check at http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    console.error('[FinSight API] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

