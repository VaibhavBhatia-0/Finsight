import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updatePreferencesSchema } from '../validators/auth.validator';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', validate({ body: registerSchema }), AuthController.register);
router.post('/login', validate({ body: loginSchema }), AuthController.login);
router.get('/me', requireAuth, AuthController.getMe);
router.put('/preferences', requireAuth, validate({ body: updatePreferencesSchema }), AuthController.updatePreferences);

export default router;

