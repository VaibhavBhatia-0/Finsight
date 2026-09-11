import jwt from 'jsonwebtoken';

const INSECURE_EXAMPLE_SECRET = 'finsight_dev_jwt_secret_replace_in_production_minimum_32_chars';

export interface TokenPayload {
  userId: string;
  email: string;
  authVersion: number;
}

function configuration() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === INSECURE_EXAMPLE_SECRET || secret.length < 48) {
    throw new Error('JWT_SECRET must be a unique high-entropy value of at least 48 characters');
  }
  return {
    secret,
    issuer: process.env.JWT_ISSUER || 'finsight-api',
    audience: process.env.JWT_AUDIENCE || 'finsight-web',
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  };
}

export function assertJwtConfiguration(): void {
  configuration();
}

export function signToken(payload: TokenPayload): string {
  const config = configuration();
  return jwt.sign(payload, config.secret, {
    algorithm: 'HS256',
    expiresIn: config.expiresIn,
    issuer: config.issuer,
    audience: config.audience,
  });
}

export function verifyToken(token: string): TokenPayload {
  const config = configuration();
  return jwt.verify(token, config.secret, {
    algorithms: ['HS256'],
    issuer: config.issuer,
    audience: config.audience,
  }) as TokenPayload;
}
