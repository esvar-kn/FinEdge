import TransferService from '../services/transferService.js';

class TransferController {
  /**
   * Lists the user's transfers.
   */
  static async getTransfers(req, res, next) {
    try {
      const transfers = await TransferService.getTransfers(req.userId);
      res.status(200).json({
        status: 'success',
        results: transfers.length,
        data: { transfers }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Records a transfer between two accounts.
   */
  static async createTransfer(req, res, next) {
    try {
      const transfer = await TransferService.addTransfer(req.userId, req.body);
      res.status(201).json({
        status: 'success',
        data: { transfer }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes a transfer.
   */
  static async deleteTransfer(req, res, next) {
    try {
      await TransferService.removeTransfer(req.params.id, req.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default TransferController;
