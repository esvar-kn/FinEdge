import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateAccountDelete,
  validateForgotPassword,
  validateResetPassword,
  requireAuth
} from '../middleware/validator.js';

const router = Router();

router.post('/register', authLimiter, validateRegister, UserController.register);
router.post('/login', authLimiter, validateLogin, UserController.login);
router.post('/forgot-password', authLimiter, validateForgotPassword, UserController.forgotPassword);
router.post('/reset-password', authLimiter, validateResetPassword, UserController.resetPassword);

// Account management (authenticated)
router.get('/me', requireAuth, UserController.getProfile);
router.get('/settings', requireAuth, UserController.getSettings);
router.put('/settings', requireAuth, UserController.updateSettings);
router.put('/password', authLimiter, requireAuth, validatePasswordChange, UserController.changePassword);
router.delete('/me', requireAuth, validateAccountDelete, UserController.deleteAccount);

export default router;
