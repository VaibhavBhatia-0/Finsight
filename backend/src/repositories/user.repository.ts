import { db } from '../database/db';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  base_currency: string;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  static async create(user: {
    id: string;
    email: string;
    passwordHash: string;
    name?: string;
    baseCurrency?: string;
  }): Promise<UserRow> {
    const res = await db.query<UserRow>(
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
}

