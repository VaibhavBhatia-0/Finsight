import crypto from 'crypto';
import { db } from '../database/db';

export class OAuthStateRepository {
  static async create() {
    const state = crypto.randomBytes(32).toString('base64url');
    await db.query(`INSERT INTO oauth_states (id, state_hash, provider, expires_at) VALUES ($1, $2, 'GOOGLE', CURRENT_TIMESTAMP + INTERVAL '10 minutes');`, [crypto.randomUUID(), hash(state)]);
    return state;
  }

  static async consume(state: string): Promise<boolean> {
    const result = await db.query(`UPDATE oauth_states SET used_at = CURRENT_TIMESTAMP WHERE state_hash = $1 AND provider = 'GOOGLE' AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP RETURNING id;`, [hash(state)]);
    return result.rows.length === 1;
  }
}

function hash(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}
