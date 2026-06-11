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
}

export default UserController;
