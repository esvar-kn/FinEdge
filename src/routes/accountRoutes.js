import { Router } from 'express';
import AccountController from '../controllers/accountController.js';
import { requireAuth, validateAccount, validateAccountUpdate } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', AccountController.getAccounts);
router.post('/', validateAccount, AccountController.createAccount);
router.put('/:id', validateAccountUpdate, AccountController.updateAccount);
router.delete('/:id', AccountController.deleteAccount);

export default router;
