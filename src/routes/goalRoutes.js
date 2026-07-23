import { Router } from 'express';
import GoalController from '../controllers/goalController.js';
import { requireAuth, validateGoal, validateContribution } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', GoalController.getGoals);
router.post('/', validateGoal, GoalController.createGoal);
router.put('/:id', GoalController.updateGoal);
router.post('/:id/contribute', validateContribution, GoalController.contribute);
router.delete('/:id', GoalController.deleteGoal);

export default router;
