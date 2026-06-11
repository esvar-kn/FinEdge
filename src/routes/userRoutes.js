import { Router } from 'express';
import UserController from '../controllers/userController.js';
import { validateRegister, validateLogin } from '../middleware/validator.js';

const router = Router();

router.post('/register', validateRegister, UserController.register);
router.post('/login', validateLogin, UserController.login);

export default router;
