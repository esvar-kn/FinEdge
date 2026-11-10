import { Router } from 'express';
import TransferController from '../controllers/transferController.js';
import { requireAuth, validateTransfer } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', TransferController.getTransfers);
router.post('/', validateTransfer, TransferController.createTransfer);
router.delete('/:id', TransferController.deleteTransfer);

export default router;
