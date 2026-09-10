import { Pool, QueryResult, QueryResultRow } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface IDatabaseClient {
  query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
  exec(sql: string): Promise<any>;
  close(): Promise<void>;
  getDriverName(): string;
}

class PostgresClient implements IDatabaseClient {
  private pool: Pool;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const res: QueryResult<T> = await this.pool.query(sql, params);
    return { rows: res.rows, rowCount: res.rowCount };
  }

  async exec(sql: string): Promise<any> {
    return this.pool.query(sql);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getDriverName(): string {
    return 'pg (Native PostgreSQL Pool)';
  }
}

class PGliteClient implements IDatabaseClient {
  private pglite: PGlite;

  constructor(dataDir?: string) {
    this.pglite = new PGlite(dataDir);
  }

  async query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const res = await this.pglite.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rows.length };
  }

  async exec(sql: string): Promise<any> {
    return this.pglite.exec(sql);
  }

  async close(): Promise<void> {
    await this.pglite.close();
  }

  getDriverName(): string {
    return 'PGlite (PostgreSQL 16 Engine)';
  }
}

let dbInstance: IDatabaseClient | null = null;

export function getDatabaseClient(forceDriver?: 'pg' | 'pglite', customDirOrUrl?: string): IDatabaseClient {
  if (dbInstance && !forceDriver) {
    return dbInstance;
  }

  const driver = forceDriver || process.env.DB_DRIVER || 'pglite';

  if (driver === 'pg' && process.env.DATABASE_URL) {
    dbInstance = new PostgresClient(customDirOrUrl);
  } else {
    // PGlite runs the genuine WASM-compiled PostgreSQL 16 engine directly
    const defaultDataDir = path.resolve(__dirname, '../../../.pglite_data');
    const dataDir = customDirOrUrl || process.env.DB_PGLITE_DATA_DIR || defaultDataDir;
    dbInstance = new PGliteClient(dataDir);
  }

  return dbInstance;
}

export const db = {
  async query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
    const client = getDatabaseClient();
    return client.query<T>(sql, params);
  }
};
