import crypto from 'crypto';
import { db, IDatabaseExecutor } from '../database/db';

export type AuthActionTokenType = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export class AuthActionTokenRepository {
  static async create(userId: string, tokenType: AuthActionTokenType, ttlMinutes: number) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    await db.transaction(async executor => {
      await executor.query('DELETE FROM auth_action_tokens WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL;', [userId, tokenType]);
      await executor.query(`
        INSERT INTO auth_action_tokens (id, user_id, token_hash, token_type, expires_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + ($5 * INTERVAL '1 minute'));
      `, [crypto.randomUUID(), userId, tokenHash, tokenType, ttlMinutes]);
    });
    return token;
  }

  static async consume(token: string, tokenType: AuthActionTokenType, executor: IDatabaseExecutor = db): Promise<{ user_id: string } | null> {
    const result = await executor.query<{ user_id: string }>(`
      UPDATE auth_action_tokens SET used_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 AND token_type = $2 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      RETURNING user_id;
    `, [hashToken(token), tokenType]);
    return result.rows[0] || null;
  }

  static async revoke(token: string): Promise<void> {
    await db.query('DELETE FROM auth_action_tokens WHERE token_hash = $1;', [hashToken(token)]);
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}
