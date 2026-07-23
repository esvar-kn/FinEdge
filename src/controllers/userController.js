import UserService from '../services/userService.js';
import config from '../config/index.js';

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
      const { email, password, rememberMe } = req.body;
      const { user, token } = await UserService.authenticateUser(email, password, rememberMe === true);

      res.status(200).json({
        status: 'success',
        data: { user, token }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Begins a password reset. Always responds 200 with a generic message so
   * email addresses can't be enumerated. When an account matches, the reset
   * token is logged server-side for the operator to relay (a real deployment
   * would email it instead — see the note in the log line).
   */
  static async forgotPassword(req, res, next) {
    try {
      const result = await UserService.requestPasswordReset(req.body.email);
      if (result) {
        console.log(
          `[password-reset] Token for ${result.user.email}: ${result.token} ` +
          `(expires in ${Math.round(config.resetTokenTtlMs / 60000)}m). ` +
          `Relay this to the user, or wire up email to send it automatically.`
        );
      }
      res.status(200).json({
        status: 'success',
        message: 'If that email is registered, a password reset code has been generated.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Completes a password reset with a valid token and a new password.
   */
  static async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      await UserService.resetPassword(token, newPassword);
      res.status(200).json({
        status: 'success',
        message: 'Password has been reset. You can now sign in with your new password.'
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
   * Returns the authenticated user's settings and supported currency options.
   */
  static async getSettings(req, res, next) {
    try {
      const settings = await UserService.getSettings(req.userId);
      res.status(200).json({
        status: 'success',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates the authenticated user's settings (currency).
   */
  static async updateSettings(req, res, next) {
    try {
      const user = await UserService.updateSettings(req.userId, { currency: req.body.currency });
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
