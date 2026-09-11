import { db, IDatabaseExecutor } from '../database/db';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  base_currency: string;
  created_at: string;
  updated_at: string;
  email_verified_at: string | null;
  auth_version: number;
  google_subject: string | null;
}

export class UserRepository {
  static async create(user: {
    id: string;
    email: string;
    passwordHash: string;
    name?: string;
    baseCurrency?: string;
  }, executor: IDatabaseExecutor = db): Promise<UserRow> {
    const res = await executor.query<UserRow>(
      `INSERT INTO users (id, email, password_hash, name, base_currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [
        user.id,
        user.email.toLowerCase().trim(),
        user.passwordHash,
        user.name || null,
        user.baseCurrency || 'INR',
      ]
    );
    return res.rows[0];
  }

  static async findByEmail(email: string): Promise<UserRow | null> {
    const res = await db.query<UserRow>(
      `SELECT * FROM users WHERE email = $1;`,
      [email.toLowerCase().trim()]
    );
    return res.rows[0] || null;
  }

  static async findById(id: string): Promise<UserRow | null> {
    const res = await db.query<UserRow>(
      `SELECT * FROM users WHERE id = $1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async markEmailVerified(id: string, executor: IDatabaseExecutor = db): Promise<UserRow | null> {
    const result = await executor.query<UserRow>('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *;', [id]);
    return result.rows[0] || null;
  }

  static async updatePassword(id: string, passwordHash: string, executor: IDatabaseExecutor = db): Promise<UserRow | null> {
    const result = await executor.query<UserRow>('UPDATE users SET password_hash = $1, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;', [passwordHash, id]);
    return result.rows[0] || null;
  }

  static async findByGoogleSubject(subject: string): Promise<UserRow | null> {
    const result = await db.query<UserRow>('SELECT * FROM users WHERE google_subject = $1;', [subject]);
    return result.rows[0] || null;
  }

  static async linkGoogle(id: string, subject: string, executor: IDatabaseExecutor = db): Promise<UserRow | null> {
    const result = await executor.query<UserRow>('UPDATE users SET google_subject = $1, email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;', [subject, id]);
    return result.rows[0] || null;
  }
}
