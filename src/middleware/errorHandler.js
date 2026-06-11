/**
 * Custom operational error class for HTTP exceptions.
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express global error-handling middleware.
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status,
    message,
    // Provide stack trace only in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
