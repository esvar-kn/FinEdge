import { Router } from 'express';
import RateController from '../controllers/rateController.js';
import { requireAuth } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', RateController.getRates);

export default router;
