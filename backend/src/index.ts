import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createApp } from './app';
import { db } from './database/db';
import { runMigrations } from './database/migrate';
import { runSeeds } from './database/seed';
import { assertJwtConfiguration } from './utils/jwt';
import type { Server } from 'http';

const PORT = Number(process.env.PORT || 5000);
let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[FinSight API] ${signal} received; closing HTTP server and database...`);
  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close(error => error ? reject(error) : resolve());
      });
    }
    await db.close();
    console.log('[FinSight API] Shutdown complete.');
    process.exit(0);
  } catch (error) {
    console.error('[FinSight API] Graceful shutdown failed:', process.env.NODE_ENV === 'production' ? 'internal shutdown error' : error);
    process.exit(1);
  }
}

async function startServer() {
  try {
    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
      throw new Error('PORT must be an integer between 1 and 65535');
    }
    assertJwtConfiguration();
    console.log('[FinSight] Initializing database...');
    await runMigrations();
    if (process.env.RUN_SEEDS_ON_STARTUP === 'true' && process.env.NODE_ENV !== 'production') {
      await runSeeds();
    }

    const app = createApp();
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[FinSight API] Server running on port ${PORT} at http://localhost:${PORT}`);
      console.log(`[FinSight API] Health check at http://localhost:${PORT}/api/v1/health`);
    });
  } catch (err) {
    console.error('[FinSight API] Failed to start server:', process.env.NODE_ENV === 'production' ? 'invalid or unavailable production configuration' : err);
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}
