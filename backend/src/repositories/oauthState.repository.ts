import crypto from 'crypto';
import { db } from '../database/db';

export class OAuthStateRepository {
  static async create() {
    const state = crypto.randomBytes(32).toString('base64url');
    const nonce = crypto.randomBytes(32).toString('base64url');
    await db.query(`INSERT INTO oauth_states (id, state_hash, nonce_hash, provider, expires_at) VALUES ($1, $2, $3, 'GOOGLE', CURRENT_TIMESTAMP + INTERVAL '10 minutes');`, [crypto.randomUUID(), hash(state), hash(nonce)]);
    return { state, nonce };
  }

  static async consume(state: string): Promise<{ nonceHash: string } | null> {
    const result = await db.query<{ nonce_hash: string }>(`UPDATE oauth_states SET used_at = CURRENT_TIMESTAMP WHERE state_hash = $1 AND provider = 'GOOGLE' AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP RETURNING nonce_hash;`, [hash(state)]);
    return result.rows[0]?.nonce_hash ? { nonceHash: result.rows[0].nonce_hash } : null;
  }
}

export function hashOAuthValue(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

const hash = hashOAuthValue;
