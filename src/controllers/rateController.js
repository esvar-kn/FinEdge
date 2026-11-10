import RateService from '../services/rateService.js';

class RateController {
  /**
   * Returns current exchange rates (units per USD) and their as-of timestamp.
   */
  static async getRates(req, res, next) {
    try {
      const data = await RateService.getRates();
      res.status(200).json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}

export default RateController;
