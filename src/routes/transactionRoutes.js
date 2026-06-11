import { Router } from 'express';
import TransactionController from '../controllers/transactionController.js';
import { requireAuth, validateTransaction } from '../middleware/validator.js';

const router = Router();

// Secure all transaction routes with the simulated authentication header
router.use(requireAuth);

router.get('/', TransactionController.getTransactions);
router.get('/summary', TransactionController.getTransactionSummary);
router.post('/', validateTransaction, TransactionController.createTransaction);
router.put('/:id', TransactionController.updateTransaction);
router.delete('/:id', TransactionController.deleteTransaction);

export default router;
