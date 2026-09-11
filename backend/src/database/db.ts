import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export interface IDatabaseExecutor {
  query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }>;
  exec(sql: string): Promise<any>;
}

export interface IDatabaseClient extends IDatabaseExecutor {
  exec(sql: string): Promise<any>;
  close(): Promise<void>;
  getDriverName(): string;
  transaction<T>(callback: (executor: IDatabaseExecutor) => Promise<T>): Promise<T>;
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

  async transaction<T>(callback: (executor: IDatabaseExecutor) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback({
        query: async <R extends QueryResultRow = any>(sql: string, params?: any[]) => {
          const response = await client.query<R>(sql, params);
          return { rows: response.rows, rowCount: response.rowCount };
        },
        exec: async (sql: string) => client.query(sql),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

  async transaction<T>(callback: (executor: IDatabaseExecutor) => Promise<T>): Promise<T> {
    return this.pglite.transaction(async transaction => callback({
      query: async <R extends QueryResultRow = any>(sql: string, params?: any[]) => {
        const response = await transaction.query<R>(sql, params);
        return { rows: response.rows as R[], rowCount: response.rows.length };
      },
      exec: (sql: string) => transaction.exec(sql),
    }));
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
  },
  async exec(sql: string): Promise<any> {
    return getDatabaseClient().exec(sql);
  },
  async transaction<T>(callback: (executor: IDatabaseExecutor) => Promise<T>): Promise<T> {
    return getDatabaseClient().transaction(callback);
  }
};
