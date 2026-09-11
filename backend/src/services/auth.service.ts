import crypto from 'crypto';
import { UserRepository, UserRow } from '../repositories/user.repository';
import { UserPreferencesRepository, UserPreferencesRow } from '../repositories/userPreferences.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { db } from '../database/db';
import { AuthActionTokenRepository } from '../repositories/authActionToken.repository';
import { EmailService } from './email.service';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    baseCurrency: string;
    emailVerified: boolean;
  };
  preferences: UserPreferencesRow;
  token: string;
}

export class AuthService {
  static async register(data: {
    email: string;
    password: string;
    name?: string;
    baseCurrency?: string;
  }): Promise<AuthResult> {
    const existing = await UserRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);
    const { user, preferences } = await db.transaction(async executor => {
      const createdUser = await UserRepository.create({
        id: userId,
        email: data.email,
        passwordHash,
        name: data.name,
        baseCurrency: data.baseCurrency || 'INR',
      }, executor);
      const createdPreferences = await UserPreferencesRepository.createDefault(userId, createdUser.base_currency, executor);
      return { user: createdUser, preferences: createdPreferences };
    });
    const token = signToken({ userId: user.id, email: user.email, authVersion: user.auth_version });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
        emailVerified: Boolean(user.email_verified_at),
      },
      preferences,
      token,
    };
  }

  static async login(email: string, password: string): Promise<AuthResult> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    let preferences = await UserPreferencesRepository.getByUserId(user.id);
    if (!preferences) {
      preferences = await UserPreferencesRepository.createDefault(user.id, user.base_currency);
    }

    const token = signToken({ userId: user.id, email: user.email, authVersion: user.auth_version });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
        emailVerified: Boolean(user.email_verified_at),
      },
      preferences,
      token,
    };
  }

  static async getProfile(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    let preferences = await UserPreferencesRepository.getByUserId(userId);
    if (!preferences) {
      preferences = await UserPreferencesRepository.createDefault(userId, user.base_currency);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
        emailVerified: Boolean(user.email_verified_at),
      },
      preferences,
    };
  }

  static async updatePreferences(userId: string, updates: Parameters<typeof UserPreferencesRepository.update>[1]) {
    const updated = await UserPreferencesRepository.update(userId, updates);
    return updated;
  }

  static async requestEmailVerification(email: string) {
    if (!EmailService.isConfigured()) throw new AppError('Authentication email delivery is not configured', 503, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    const user = await UserRepository.findByEmail(email);
    if (user && !user.email_verified_at) {
      const token = await AuthActionTokenRepository.create(user.id, 'EMAIL_VERIFICATION', 60 * 24);
      try {
        await EmailService.sendAction({ to: user.email, action: 'verify_email', actionUrl: `${process.env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`, expiresInMinutes: 60 * 24 });
      } catch (error) {
        await AuthActionTokenRepository.revoke(token);
        throw error;
      }
    }
    return { accepted: true };
  }

  static async verifyEmail(token: string) {
    return db.transaction(async executor => {
      const action = await AuthActionTokenRepository.consume(token, 'EMAIL_VERIFICATION', executor);
      if (!action) throw new AppError('Verification token is invalid or expired', 400, 'INVALID_VERIFICATION_TOKEN');
      const user = await UserRepository.markEmailVerified(action.user_id, executor);
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      return { verified: true };
    });
  }

  static async requestPasswordReset(email: string) {
    if (!EmailService.isConfigured()) throw new AppError('Authentication email delivery is not configured', 503, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    const user = await UserRepository.findByEmail(email);
    if (user) {
      const token = await AuthActionTokenRepository.create(user.id, 'PASSWORD_RESET', 30);
      try {
        await EmailService.sendAction({ to: user.email, action: 'reset_password', actionUrl: `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`, expiresInMinutes: 30 });
      } catch (error) {
        await AuthActionTokenRepository.revoke(token);
        throw error;
      }
    }
    return { accepted: true };
  }

  static async resetPassword(token: string, password: string) {
    const passwordHash = await hashPassword(password);
    return db.transaction(async executor => {
      const action = await AuthActionTokenRepository.consume(token, 'PASSWORD_RESET', executor);
      if (!action) throw new AppError('Password reset token is invalid or expired', 400, 'INVALID_RESET_TOKEN');
      const user = await UserRepository.updatePassword(action.user_id, passwordHash, executor);
      if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      return { reset: true };
    });
  }
}
