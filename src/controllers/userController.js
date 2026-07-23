import UserService from '../services/userService.js';

class UserController {
  /**
   * Register handler.
   */
  static async register(req, res, next) {
    try {
      const { username, email, password } = req.body;
      const { user, token } = await UserService.registerUser(username, email, password);
      
      res.status(201).json({
        status: 'success',
        data: { user, token }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login handler.
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { user, token } = await UserService.authenticateUser(email, password);
      
      res.status(200).json({
        status: 'success',
        data: { user, token }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns the authenticated user's profile.
   */
  static async getProfile(req, res, next) {
    try {
      const user = await UserService.getProfile(req.userId);
      res.status(200).json({
        status: 'success',
        data: { user }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changes the authenticated user's password.
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      await UserService.changePassword(req.userId, currentPassword, newPassword);
      res.status(200).json({
        status: 'success',
        message: 'Password updated successfully.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Deletes the authenticated user's account and all their transactions.
   * Requires the account password in the body as confirmation.
   */
  static async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;
      await UserService.deleteAccount(req.userId, password);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default UserController;
