// Import suites sequentially to prevent concurrent file I/O race conditions
import './user.suite.js';
import './transaction.suite.js';
import './concurrency.suite.js';
import './features.suite.js';
import './highimpact.suite.js';
import './lowimpact.suite.js';
