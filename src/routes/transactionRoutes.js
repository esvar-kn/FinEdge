import { Router } from 'express';
import express from 'express';
import TransactionController from '../controllers/transactionController.js';
import { requireAuth, validateTransaction, validateTransactionUpdate } from '../middleware/validator.js';

const router = Router();

// Secure all transaction routes with JWT authentication
router.use(requireAuth);

// Fixed paths must be registered before the /:id parameter route
router.get('/', TransactionController.getTransactions);
router.get('/summary', TransactionController.getTransactionSummary);
router.get('/ai-insights', TransactionController.getAiInsights);
router.get('/trend', TransactionController.getMonthlyTrend);
router.get('/export', TransactionController.exportTransactions);
router.post(
  '/import',
  express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }),
  TransactionController.importTransactions
);
router.post('/', validateTransaction, TransactionController.createTransaction);
router.put('/:id', validateTransactionUpdate, TransactionController.updateTransaction);
router.delete('/:id', TransactionController.deleteTransaction);

export default router;
