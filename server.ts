import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authRoutes } from './src/server/routes/authRoutes.ts';
import { projectRoutes } from './src/server/routes/projectRoutes.ts';
import { documentRoutes } from './src/server/routes/documentRoutes.ts';
import { findingRoutes } from './src/server/routes/findingRoutes.ts';
import { handoverRoutes } from './src/server/routes/handoverRoutes.ts';
import { githubRoutes } from './src/server/routes/githubRoutes.ts';
import { activityRoutes } from './src/server/routes/activityRoutes.ts';
import { connectorRoutes } from './src/server/routes/connectorRoutes.ts';
import { ragRoutes } from './src/server/routes/ragRoutes.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middleware
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'KNOWBRIDGE AI Server Engine',
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
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

async function startServer() {
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

  app.listen(PORT, () => {
    console.log(`[KNOWBRIDGE AI] Enterprise Server Engine listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
