require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const socketService = require('./services/socket');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend running', timestamp: new Date() });
});

// API routes
app.use('/api', routes);

// Error handler (must be registered last)
app.use(errorHandler);

// Database connection
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));
} else {
  console.log('MONGODB_URI not set — skipping database connection');
}

// Socket.io needs a raw http.Server to attach to (not the Express app
// directly) — app itself is still exported unchanged below, so
// require('./server') in tests keeps working exactly as before (supertest
// wraps the Express app in its own ephemeral server per request).
const httpServer = http.createServer(app);
socketService.init(httpServer);

// Start server
if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  // Guarded the same way httpServer.listen() is — every test file does
  // `require('../server')`, and starting a real setInterval that makes
  // real blockchain calls during automated tests would be a serious
  // problem (10 test files × their own interval, hitting real Mongo test
  // data and the real chain). Only actually starts when this file is
  // run directly, i.e. the real dev/production server.
  require('./jobs/settlementScheduler').start();
}

module.exports = app;
