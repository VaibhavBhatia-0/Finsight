import crypto from 'crypto';
import { db, IDatabaseExecutor } from '../database/db';

export interface AuthIdentityRow {
  id: string;
  user_id: string;
  provider: 'GOOGLE';
  provider_subject: string;
  created_at: string;
  updated_at: string;
}

export class AuthIdentityRepository {
  static async findBySubject(provider: 'GOOGLE', subject: string, executor: IDatabaseExecutor = db): Promise<AuthIdentityRow | null> {
    const result = await executor.query<AuthIdentityRow>(
      'SELECT * FROM auth_identities WHERE provider = $1 AND provider_subject = $2;',
      [provider, subject],
    );
    return result.rows[0] || null;
  }

  static async findByUser(provider: 'GOOGLE', userId: string, executor: IDatabaseExecutor = db): Promise<AuthIdentityRow | null> {
    const result = await executor.query<AuthIdentityRow>(
      'SELECT * FROM auth_identities WHERE provider = $1 AND user_id = $2;',
      [provider, userId],
    );
    return result.rows[0] || null;
  }

  static async link(provider: 'GOOGLE', subject: string, userId: string, executor: IDatabaseExecutor = db): Promise<AuthIdentityRow> {
    const existingSubject = await this.findBySubject(provider, subject, executor);
    if (existingSubject) return existingSubject;
    const existingUser = await this.findByUser(provider, userId, executor);
    if (existingUser) return existingUser;
    const result = await executor.query<AuthIdentityRow>(
      `INSERT INTO auth_identities (id, user_id, provider, provider_subject)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [crypto.randomUUID(), userId, provider, subject],
    );
    return result.rows[0];
  }
}
