import { Router } from 'express';
import CategoryService from '../services/categoryService.js';
import { requireAuth } from '../middleware/validator.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { used, suggestions } = await CategoryService.getCategories(req.userId);
    res.status(200).json({
      status: 'success',
      data: { used, suggestions }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
