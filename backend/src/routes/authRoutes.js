import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController.js';

export const authRoutes = Router();

// Throttle credential/code attempts to blunt brute force.
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

authRoutes.post('/admin/login', loginLimiter, authController.loginAdmin);
authRoutes.post('/redeem', loginLimiter, authController.redeem);
authRoutes.get('/me', authController.me);
authRoutes.post('/logout', authController.logout);
