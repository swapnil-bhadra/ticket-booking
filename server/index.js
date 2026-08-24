import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import bookingRoutes from './routes/bookings.js';
import venueRoutes from './routes/venues.js';
import { initializeScheduler } from './scheduler/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ===== ROOT ROUTE (FIX) =====
app.get('/', (req, res) => {
  res.json({ 
    message: '🎟️ Ticket Booking System API',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      bookings: '/api/bookings',
      venues: '/api/venues',
      health: '/health'
    }
  });
});

// ===== API ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/venues', venueRoutes);

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ===== SERVE FRONTEND (if deployed together) =====
// Uncomment this if your frontend is in client/build
/*
const clientBuildPath = path.join(__dirname, '../client/build');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});
*/

// ===== INITIALIZE SCHEDULER =====
initializeScheduler();

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎟️ Ticket Booking System running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Root endpoint: http://localhost:${PORT}/`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

export default app;