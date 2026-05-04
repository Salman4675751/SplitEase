// Load .env from this file's directory regardless of process.cwd()
// (so PM2 / systemd / Docker can launch us from any working dir).
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

connectDB();

// Allow multiple comma-separated origins in CLIENT_URL for prod (e.g. apex + www)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser requests (curl, server-to-server) which have no Origin
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Trust proxy headers (NGINX/CloudPanel sets X-Forwarded-For + X-Forwarded-Proto)
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/groups', require('./src/routes/groups'));
app.use('/api/expenses', require('./src/routes/expenses'));
app.use('/api/settlements', require('./src/routes/settlements'));

app.use('/api/activity', require('./src/routes/activity'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Friendly root response so visiting http://localhost:5000 directly isn't confusing
app.get('/', (req, res) => {
  res.json({
    name: 'SplitEase API',
    status: 'running',
    docs: 'All endpoints are under /api/*',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/{register,login,me}',
      users: '/api/users/{profile,balance-summary,search}',
      groups: '/api/groups',
      expenses: '/api/expenses',
      settlements: '/api/settlements',
    },
    frontend: 'http://localhost:5173',
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the recurring expense scheduler after the server is up
  require('./src/utils/recurringScheduler').start();
});
