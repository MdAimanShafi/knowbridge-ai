import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRoutes } from './src/server/routes/authRoutes.ts';
import { projectRoutes } from './src/server/routes/projectRoutes.ts';
import { documentRoutes } from './src/server/routes/documentRoutes.ts';
import { findingRoutes } from './src/server/routes/findingRoutes.ts';
import { handoverRoutes } from './src/server/routes/handoverRoutes.ts';
import { githubRoutes } from './src/server/routes/githubRoutes.ts';
import { activityRoutes } from './src/server/routes/activityRoutes.ts';
import { connectorRoutes } from './src/server/routes/connectorRoutes.ts';
import { ragRoutes } from './src/server/routes/ragRoutes.ts';
import { isGeminiConfigured } from './src/server/gemini.ts';
import {
  getDatabaseHealth,
  initDatabase,
  closeDatabase,
} from './src/server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait before retrying.' },
  skipSuccessfulRequests: false,
});

const createAiLimiter = (message: string, max = 60) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
const aiQueryLimiter = createAiLimiter('Too many AI queries. Please slow down and retry shortly.');
const aiDocumentLimiter = createAiLimiter('Too many document analysis requests. Please slow down and retry shortly.');
const aiUploadLimiter = createAiLimiter('Too many document uploads. Please slow down and retry shortly.', 20);

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              styleSrcAttr: ["'unsafe-inline'"],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              connectSrc: ["'self'", 'https://generativelanguage.googleapis.com', 'https://api.github.com'],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    crossOriginResourcePolicy: false,
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

app.use('/api/auth', authLimiter);
app.use('/api/projects/:projectId/rag/query', aiQueryLimiter);
app.use('/api/documents/:id/process', aiDocumentLimiter);
app.post('/api/projects/:projectId/documents', aiUploadLimiter);

// Health check endpoint with database health telemetry
app.get('/api/health', async (_req, res) => {
  const dbHealth = await getDatabaseHealth();
  const statusCode = dbHealth.status === 'UP' ? 200 : 503;
  res.status(statusCode).json({
    status: dbHealth.status === 'UP' ? 'HEALTHY' : 'DEGRADED',
    service: 'KNOWBRIDGE AI Server Engine',
    database: {
      mode: dbHealth.mode,
      status: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error,
    },
    aiProvider: isGeminiConfigured() ? 'GEMINI' : 'GROUNDED_FALLBACK',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', documentRoutes);
app.use('/api', findingRoutes);
app.use('/api', handoverRoutes);
app.use('/api/integrations/github', githubRoutes);
app.use('/api', connectorRoutes);
app.use('/api', ragRoutes);
app.use('/api', activityRoutes);

// Explicit 404 handler for /api/* to guarantee API calls never return index.html
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error: err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds the 30 MB limit.' : 'Invalid file upload.',
    });
  }
  if (err?.message === 'Origin is not allowed by CORS.') {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  if (err?.status === 413 || err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body exceeds the allowed size.' });
  }
  if (err?.status === 400 && err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  console.error('Unhandled server error:', err instanceof Error ? err.message : 'Unknown server error');
  return res.status(500).json({ error: 'Internal Server Error' });
});

export async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV === 'production') {
    // Serve production static assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // Development mode with Vite middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(PORT, () => {
    console.log(`[KNOWBRIDGE AI] Enterprise Server Engine listening on port ${PORT}`);
  });

  return server;
}

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('[KNOWBRIDGE AI] SIGTERM received. Gracefully closing resources...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[KNOWBRIDGE AI] SIGINT received. Gracefully closing resources...');
  await closeDatabase();
  process.exit(0);
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
