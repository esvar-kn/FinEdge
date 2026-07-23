import { Router } from 'express';
import BudgetController from '../controllers/budgetController.js';
import { requireAuth, validateBudget } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', BudgetController.getBudgets);
router.put('/:category', validateBudget, BudgetController.setBudget);
router.delete('/:category', BudgetController.deleteBudget);

export default router;
