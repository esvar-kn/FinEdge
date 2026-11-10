import { Router } from 'express';
import DebtController from '../controllers/debtController.js';
import { requireAuth, validateDebt, validateDebtPayment } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', DebtController.getDebts);
router.post('/', validateDebt, DebtController.createDebt);
router.put('/:id', DebtController.updateDebt);
router.get('/:id/payoff', DebtController.getPayoff);
router.post('/:id/payment', validateDebtPayment, DebtController.payDebt);
router.delete('/:id', DebtController.deleteDebt);

export default router;
