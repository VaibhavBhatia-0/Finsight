import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { emailActionRequestSchema, googleCallbackQuerySchema, registerSchema, loginSchema, resetPasswordSchema, updatePreferencesSchema, verifyEmailSchema } from '../validators/auth.validator';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.post('/register', rateLimit({ windowMs: 60_000, max: 10 }), validate({ body: registerSchema }), AuthController.register);
router.post('/login', rateLimit({ windowMs: 60_000, max: 20 }), validate({ body: loginSchema }), AuthController.login);
router.get('/me', requireAuth, AuthController.getMe);
router.put('/preferences', requireAuth, validate({ body: updatePreferencesSchema }), AuthController.updatePreferences);
router.post('/verification/request', rateLimit({ windowMs: 60_000, max: 5 }), validate({ body: emailActionRequestSchema }), AuthController.requestEmailVerification);
router.post('/verification/confirm', validate({ body: verifyEmailSchema }), AuthController.verifyEmail);
router.post('/password-reset/request', rateLimit({ windowMs: 60_000, max: 5 }), validate({ body: emailActionRequestSchema }), AuthController.requestPasswordReset);
router.post('/password-reset/confirm', validate({ body: resetPasswordSchema }), AuthController.resetPassword);
router.get('/google', rateLimit({ windowMs: 60_000, max: 20 }), AuthController.googleStart);
router.get('/google/callback', rateLimit({ windowMs: 60_000, max: 20 }), validate({ query: googleCallbackQuerySchema }), AuthController.googleCallback);

export default router;
