import './config/load-environment.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { environment } from './config/environment.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { cache } from './infrastructure/cache.js';
import { database } from './infrastructure/database.js';
import { requireAuthentication } from './middleware/auth.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { authRouter } from './modules/auth/index.js';
import { analysisRouter } from './modules/analysis/index.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { alertsRouter } from './modules/alerts/index.js';
import { analystRouter } from './modules/analyst/index.js';
import { adminRouter } from './modules/admin/index.js';

const app = express();

const allowedOrigins = [
  environment.CLIENT_ORIGIN,
  'https://phishguard-13d23f.netlify.app',
  'http://localhost:5173',
].filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_request, response) => {
  const dependencies = { database: 'unavailable', cache: 'unavailable' };
  try {
    await database.$queryRaw`SELECT 1`;
    dependencies.database = 'ok';
  } catch {
    /* report dependency state */
  }
  try {
    if (cache.status === 'wait') await cache.connect();
    await cache.ping();
    dependencies.cache = 'ok';
  } catch {
    /* report dependency state */
  }
  response.json({ service: 'phishguard-api', ...dependencies });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/analyses', analysisRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/analyst', analystRouter);
app.use('/api/v1/admin', adminRouter);

// Serve React client static files
const clientBuildPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));
app.get('/api/v1/private', requireAuthentication, (request, response) =>
  response.json({ user: request.authenticatedUser }),
);

// Catch‑all fallback for client‑side routing (must be after API routes)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientBuildPath, 'index.html'));
  }
  next();
});
app.use(errorHandler);

app.listen(environment.PORT, () => console.log(`PhishGuard API listening on ${environment.PORT}`));
