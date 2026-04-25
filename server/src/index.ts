import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './models/database';
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import logbookRoutes from './routes/logbook.routes';
import attendanceRoutes from './routes/attendance.routes';
import companyRoutes from './routes/company.routes';
import supervisorRoutes from './routes/supervisor.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportRoutes from './routes/report.routes';
import notificationRoutes from './routes/notification.routes';
import settingsRoutes from './routes/settings.routes';
import adminRoutes from './routes/admin.routes';
import feedbackRoutes from './routes/feedback.routes';
import aiRoutes from './routes/ai.routes';
import chatRoutes from './routes/chat.routes';
import morgan from 'morgan';
import { errorHandler } from './middleware/error.middleware';
import { startMonitoringSchedule } from './jobs/monitoring.job';
import logger from './utils/logger';
import { validateEnv } from './utils/env';

dotenv.config();
console.log('🚀 Starting ACETEL VIMS Server...');
validateEnv();

const app = express();
app.set('trust proxy', 1); // Required for express-rate-limit on Render
const httpServer = createServer(app);

// Production-ready Middleware Stack
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production' ? true : false,
}));
app.use(compression());
app.use(cookieParser(process.env.COOKIE_SECRET || 'acetel-vims-secret'));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting (Global & Specific)
const globalLimiter = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 1000,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 authentication attempts per hour
  message: { error: 'Too many login attempts, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Ensure required directories exist (ephemeral on Render free tier — use a persistent disk or cloud storage for production uploads)
const dataDir = path.join(process.cwd(), 'data');
const uploadsDir = path.join(process.cwd(), 'uploads');
const logsDir = path.join(process.cwd(), 'logs');

for (const dir of [dataDir, uploadsDir, logsDir]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    logger.warn('⚠️  Could not create directory: %s (filesystem may be read-only)', dir);
  }
}

if (process.env.NODE_ENV === 'production') {
  logger.warn('⚠️  File uploads are stored locally. On Render free tier the disk is ephemeral — files will be lost on redeploy. Add a Render Persistent Disk or integrate cloud storage (e.g. Cloudinary, S3) for production.');
}

// Socket.IO for real-time notifications (Global Institutional Grade)
export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const connectedUsers = new Map<string, string>();

io.on('connection', (socket) => {
  logger.info('🔌 Socket client connected: %s', socket.id);
  socket.on('register', (userId: string) => {
    connectedUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
  });
  socket.on('disconnect', () => {
    connectedUsers.forEach((sid, uid) => { if (sid === socket.id) connectedUsers.delete(uid); });
  });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

// Root route (for Render health check / monitoring)
app.get('/', (_, res) => {
  res.status(200).json({ status: 'live', service: 'ACETEL VIMS API' });
});

// Health check
app.get('/api/health', (_, res) => {
  res.json({ 
    status: 'ok', 
    client: 'ACETEL PG Virtual Internship Management', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString() 
  });
});

// --- Institutional API Orchestration ---
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/students', studentRoutes);
apiRouter.use('/logbook', logbookRoutes);
apiRouter.use('/attendance', attendanceRoutes);
apiRouter.use('/companies', companyRoutes);
apiRouter.use('/supervisors', supervisorRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/feedback', feedbackRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/chat', chatRoutes);

// Mount API routes under /api prefix
app.use('/api', apiRouter);

// Serve React frontend in production (single-service Render deployment)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(process.cwd(), '..', 'client', 'dist');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    // All non-API routes serve the React app (client-side routing)
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/socket.io')) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      }
    });
    logger.info('📦 Serving React client from: %s', clientBuildPath);
  } else {
    logger.warn('⚠️  Client build not found at %s. Run "npm run build" in the client directory.', clientBuildPath);
  }
}

// GLOBAL ERROR HANDLER (MUST BE LAST)
app.use(errorHandler);

// Init DB then start server
const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  startMonitoringSchedule();
  httpServer.listen(PORT, () => {
    logger.info('🚀 ACETEL Virtual Internship Management Server running on port %s', PORT);
    logger.info('📡 Socket.IO ready');
    logger.info('🗄️  Database initialized');
  });
}).catch(err => {
  console.error('CRITICAL APP CRASH: Failed to initialize database:', err);
  logger.error('Failed to initialize database: %s', (err as Error).message);
  process.exit(1);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});
