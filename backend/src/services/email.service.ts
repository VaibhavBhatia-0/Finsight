import { AppError } from '../middleware/errorHandler';

export class EmailService {
  static isConfigured(): boolean {
    return Boolean(process.env.AUTH_EMAIL_WEBHOOK_URL && process.env.AUTH_EMAIL_WEBHOOK_TOKEN && process.env.FRONTEND_URL);
  }

  static async sendAction(input: { to: string; action: 'verify_email' | 'reset_password'; actionUrl: string; expiresInMinutes: number }) {
    if (!this.isConfigured()) throw new AppError('Authentication email delivery is not configured', 503, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    const response = await fetch(process.env.AUTH_EMAIL_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AUTH_EMAIL_WEBHOOK_TOKEN}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new AppError('Authentication email delivery failed', 502, 'EMAIL_DELIVERY_FAILED');
  }
}
