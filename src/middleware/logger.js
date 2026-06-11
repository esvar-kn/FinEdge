/**
 * Custom request logger middleware.
 * Logs: [Timestamp] Method Path IP (Execution Time)
 */
export default function loggerMiddleware(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${method} ${originalUrl} from ${ip} (${duration}ms)`);
  });

  next();
}
