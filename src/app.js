import express from 'express';
import dotenv from 'dotenv';
import loggerMiddleware from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import userRoutes from './routes/userRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for logging requests
app.use(loggerMiddleware);

// Middleware for parsing JSON requests
app.use(express.json());

// Mount Routes
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);

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
  app.listen(PORT, () => {
    console.log(`FinEdge API Server is running on port ${PORT}`);
  });
}

export default app;
