import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import toolkitRoutes from './routes/toolkit.routes';
import accountRoutes from './routes/account.routes';
import brokerRoutes from './routes/broker.routes';
import marketRoutes from './routes/market.routes';
import contentRoutes from './routes/content.routes';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '6mb' })); // headroom for base64 KYC document uploads
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / curl (no origin) and any configured origin.
      if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  }),
);

if (!env.isProd) app.use(morgan('dev'));

// Global rate limiter.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Stricter limiter for auth endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'nxp-api', time: new Date().toISOString() }));
app.get('/', (_req, res) => res.json({ name: 'NexTradePro API', version: '1.0.0', docs: '/health' }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin/toolkit', toolkitRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/content', contentRoutes);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Safety net: a single rejected promise or thrown async error should be logged,
// not crash the whole API process.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', err);
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 NexTradePro API listening on :${env.port} (${env.nodeEnv})`);
});

export default app;
