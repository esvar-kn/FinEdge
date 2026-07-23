import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import {
  validateRegister,
  validateLogin,
  validatePasswordChange,
  validateAccountDelete,
  requireAuth
} from '../middleware/validator.js';

const router = Router();

router.post('/register', authLimiter, validateRegister, UserController.register);
router.post('/login', authLimiter, validateLogin, UserController.login);

// Account management (authenticated)
router.get('/me', requireAuth, UserController.getProfile);
router.put('/password', authLimiter, requireAuth, validatePasswordChange, UserController.changePassword);
router.delete('/me', requireAuth, validateAccountDelete, UserController.deleteAccount);

export default router;
