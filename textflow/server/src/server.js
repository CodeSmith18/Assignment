import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-key',
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

// TODO: Add route handlers
// app.use('/api/auth', authRoutes);
// app.use('/api/process', textRoutes);
// app.use('/api/usage', usageRoutes);
// app.use('/api', billingRoutes);

app.listen(PORT, () => {
  console.log(`🚀 TextFlow server running on port ${PORT}`);
  console.log(`📊 Flexprice API: ${process.env.FLEXPRICE_BASE_URL}`);
  console.log(`🌐 CORS origin: ${process.env.CLIENT_ORIGIN}`);
});
