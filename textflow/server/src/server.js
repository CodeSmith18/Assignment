import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { initDatabase } from './db/init.js';
import { validateEnv, config } from './config/env.js';
import authRoutes from './routes/auth.js';
import textRoutes from './routes/text.js';
import usageRoutes from './routes/usage.js';
import billingRoutes from './routes/billing.js';
import { requireAuth } from './middleware/requireAuth.js';

// Validate environment variables on boot
validateEnv();

const app = express();
const PORT = config.port || 4000;

// Middleware
app.use(cors({
  origin: config.clientOrigin || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: config.sessionSecret || 'dev-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  }
}));

// Initialize database
initDatabase();

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route Handlers
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/process', requireAuth, textRoutes);
app.use('/api/usage', requireAuth, usageRoutes);
app.use('/api/billing', requireAuth, billingRoutes);

app.listen(PORT, () => {
  console.log(`🚀 TextFlow server running on port ${PORT}`);
  console.log(`📊 Flexprice API: ${config.flexpriceBaseUrl}`);
  console.log(`🌐 CORS origin: ${config.clientOrigin}`);
});
