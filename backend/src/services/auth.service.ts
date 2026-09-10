import crypto from 'crypto';
import { UserRepository, UserRow } from '../repositories/user.repository';
import { UserPreferencesRepository, UserPreferencesRow } from '../repositories/userPreferences.repository';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    baseCurrency: string;
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
    const user = await UserRepository.create({
      id: userId,
      email: data.email,
      passwordHash,
      name: data.name,
      baseCurrency: data.baseCurrency || 'INR',
    });

    const preferences = await UserPreferencesRepository.createDefault(userId, user.base_currency);
    const token = signToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
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

    const token = signToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        baseCurrency: user.base_currency,
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
      },
      preferences,
    };
  }

  static async updatePreferences(userId: string, updates: any) {
    const updated = await UserPreferencesRepository.update(userId, updates);
    return updated;
  }
}

