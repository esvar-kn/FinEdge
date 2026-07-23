import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/index.js';
import loggerMiddleware from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import userRoutes from './routes/userRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';
import recurringRoutes from './routes/recurringRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { scheduleBackups } from './utils/backup.js';
import RecurringService from './services/recurringService.js';

import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers (helmet) and optional CORS. Without CORS_ORIGIN set, no
// CORS headers are sent — browsers stay same-origin, the safest default.
// The CSP is widened from helmet's default to permit the CDNs the bundled
// frontend loads (Tailwind Play CDN, Chart.js, Google Fonts). Tailwind's Play
// CDN requires 'unsafe-eval'/'unsafe-inline'; acceptable for a self-hosted
// personal/family app. To tighten it later, self-host these assets and drop
// the extra sources back to 'self'.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
        'connect-src': ["'self'"],
        'img-src': ["'self'", 'data:']
      }
    }
  })
);
if (config.corsOrigin) {
  app.use(cors({ origin: config.corsOrigin }));
}

// Middleware for logging requests
app.use(loggerMiddleware);

// Middleware for parsing JSON requests
app.use(express.json());

// Mount Routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/categories', categoryRoutes);

// Serve static frontend files
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '../FrontEnd')));

// Server health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'up' });
});

// Centralized error handling middleware
app.use(errorHandler);

// Start listening for connections only if run directly
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === process.argv[1] ||
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
);

if (isMain) {
  scheduleBackups();
  // Materialize any recurring transactions that came due while the server was off.
  RecurringService.materializeAll()
    .then(created => {
      if (created > 0) console.log(`Recurring rules materialized ${created} transaction(s).`);
    })
    .catch(err => console.error('Recurring rule sweep failed:', err));
  app.listen(PORT, () => {
    console.log(`FinEdge API Server is running on port ${PORT}`);
  });
}

export default app;
