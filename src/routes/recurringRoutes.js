import { Router } from 'express';
import RecurringController from '../controllers/recurringController.js';
import { requireAuth, validateRecurringRule } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', RecurringController.getRules);
router.get('/upcoming', RecurringController.getUpcoming);
router.post('/', validateRecurringRule, RecurringController.createRule);
router.delete('/:id', RecurringController.deleteRule);

export default router;
