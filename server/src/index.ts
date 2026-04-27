import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { rateLimit } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
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
import emailRoutes from './routes/email.routes';
import morgan from 'morgan';
import { errorHandler } from './middleware/error.middleware';
import { startMonitoringSchedule } from './jobs/monitoring.job';
import logger from './utils/logger';
import { validateEnv } from './utils/env';
import { securityHeaders, sanitiseInput } from './middleware/security.middleware';
import { firewallMiddleware } from './middleware/firewall.middleware';
import firewallRoutes from './routes/firewall.routes';
import { startIPBlockerSchedule } from './jobs/ip-blocker.job';

dotenv.config();
console.log('🚀 Starting ACETEL VIMS Server...');
validateEnv();

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

// ─────────────────────────────────────────────────────────────────────────────
// 0. FIREWALL — IP blocking check (first middleware — blocks before any processing)
// ─────────────────────────────────────────────────────────────────────────────
app.use(firewallMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// 1. HELMET — HTTP security headers
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],   // React inline scripts
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", process.env.FRONTEND_URL || '', 'wss:', 'ws:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  crossOriginEmbedderPolicy: false,   // Allow cross-origin resources (maps, fonts)
  hsts: {
    maxAge: 31536000,                 // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 2. CORS — whitelist only known frontend
// ─────────────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(u => u.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server (no origin) and whitelisted origins only
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from: %s', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,   // Cache preflight for 24 hours
}));

// ─────────────────────────────────────────────────────────────────────────────
// 3. BODY PARSING — strict size limits
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));          // was 10mb — unnecessary
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Additional security headers + input sanitisation
app.use(securityHeaders);
app.use(sanitiseInput);

// ─────────────────────────────────────────────────────────────────────────────
// 4. NoSQL INJECTION PREVENTION — strip $ and . from all input
// ─────────────────────────────────────────────────────────────────────────────
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }: { req: any; key: string }) => {
    logger.warn('⚠️ MongoDB operator injection attempt — field: %s | IP: %s', key, req.ip);
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 5. HTTP PARAMETER POLLUTION PREVENTION
// ─────────────────────────────────────────────────────────────────────────────
app.use(hpp({
  whitelist: ['role', 'status', 'category', 'priority'],  // these can appear multiple times
}));

// ─────────────────────────────────────────────────────────────────────────────
// 6. RATE LIMITING — layered global + per-endpoint
// ─────────────────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,                             // 500 req per 15min per IP (was 1000)
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health', // don't rate-limit health checks
});

// Speed limiter — starts slowing responses after 100 req/15min
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: (used: number) => (used - 100) * 200, // +200ms per request above 100
});

app.use(globalLimiter);
app.use(speedLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 7. LOGGING — structured, no sensitive data
// ─────────────────────────────────────────────────────────────────────────────
app.use(compression());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim()) },
  skip: (req) => req.path === '/api/health',  // suppress health check noise
}));

// ─────────────────────────────────────────────────────────────────────────────
// 8. DIRECTORY SETUP
// ─────────────────────────────────────────────────────────────────────────────
const dataDir    = path.join(process.cwd(), 'data');
const uploadsDir = path.join(process.cwd(), 'uploads');
const logsDir    = path.join(process.cwd(), 'logs');

for (const dir of [dataDir, uploadsDir, logsDir]) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    logger.warn('⚠️  Could not create directory: %s', dir);
  }
}

if (process.env.NODE_ENV === 'production') {
  logger.warn('⚠️  File uploads are stored locally. Add a Render Persistent Disk or integrate Cloudinary/S3 for production.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. SOCKET.IO — user-scoped rooms, no unauthenticated broadcast
// ─────────────────────────────────────────────────────────────────────────────
export const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6,    // 1MB max socket payload
});

const connectedUsers = new Map<string, string>();

io.on('connection', (socket) => {
  socket.on('register', (userId: string) => {
    // Validate userId looks like a MongoDB ObjectId before joining room
    if (typeof userId === 'string' && /^[0-9a-fA-F]{24}$/.test(userId)) {
      connectedUsers.set(userId, socket.id);
      socket.join(`user:${userId}`);
    } else {
      logger.warn('Socket: invalid userId format on register: %s', userId);
      socket.disconnect(true);
    }
  });
  socket.on('disconnect', () => {
    connectedUsers.forEach((sid, uid) => { if (sid === socket.id) connectedUsers.delete(uid); });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. STATIC FILES — uploads served with no directory listing
// ─────────────────────────────────────────────────────────────────────────────
app.use('/uploads', (req, res, next) => {
  // Block directory traversal in static serving
  if (req.path.includes('..') || req.path.includes('//')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, express.static(uploadsDir, {
  dotfiles: 'deny',
  index: false,    // No directory listing
  etag: true,
  maxAge: '7d',
}));

// ─────────────────────────────────────────────────────────────────────────────
// 11. HEALTH + ROOT
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (_, res) => {
  res.status(200).json({ status: 'live', service: 'ACETEL VIMS API' });
});

app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'ACETEL PG Virtual Internship Management',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. API ROUTES
// ─────────────────────────────────────────────────────────────────────────────
const apiRouter = express.Router();
apiRouter.use('/auth',          authRoutes);
apiRouter.use('/students',      studentRoutes);
apiRouter.use('/logbook',       logbookRoutes);
apiRouter.use('/attendance',    attendanceRoutes);
apiRouter.use('/companies',     companyRoutes);
apiRouter.use('/supervisors',   supervisorRoutes);
apiRouter.use('/analytics',     analyticsRoutes);
apiRouter.use('/reports',       reportRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/settings',      settingsRoutes);
apiRouter.use('/admin',         adminRoutes);
apiRouter.use('/feedback',      feedbackRoutes);
apiRouter.use('/ai',            aiRoutes);
apiRouter.use('/chat',          chatRoutes);
apiRouter.use('/email',         emailRoutes);
apiRouter.use('/firewall',      firewallRoutes);

app.use('/api', apiRouter);

// ─────────────────────────────────────────────────────────────────────────────
// 13. REACT SPA FALLBACK (production)
// ─────────────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(process.cwd(), '..', 'client', 'dist');
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath, { index: false, dotfiles: 'deny' }));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/socket.io')) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });
  } else {
    logger.warn('⚠️  Client build not found at %s.', clientBuildPath);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. GLOBAL ERROR HANDLER — never leak stack traces
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// 15. STARTUP
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  startMonitoringSchedule();
  startIPBlockerSchedule();
  httpServer.listen(PORT, () => {
    logger.info('🚀 ACETEL Virtual Internship Management Server running on port %s', PORT);
    logger.info('📡 Socket.IO ready');
    logger.info('🗄️  Database initialized');
  });
}).catch(err => {
  logger.error('CRITICAL: Failed to initialize database: %s', (err as Error).message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => { logger.info('HTTP server closed.'); process.exit(0); });
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — %s', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION — %s', String(reason));
  process.exit(1);
});
