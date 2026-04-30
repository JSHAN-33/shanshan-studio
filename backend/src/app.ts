import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { prismaPlugin } from './plugins/prisma.js';
import { bookingsRoutes } from './routes/bookings.js';
import { membersRoutes } from './routes/members.js';
import { servicesRoutes } from './routes/services.js';
import { slotsRoutes } from './routes/slots.js';
import { costsRoutes } from './routes/costs.js';
import { financeRoutes } from './routes/finance.js';
import { inventoryRoutes } from './routes/inventory.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { lineWebhookRoutes } from './routes/lineWebhook.js';
import { serviceHistoryRoutes } from './routes/serviceHistory.js';
import { settingsRoutes } from './routes/settings.js';
import { icalRoutes } from './routes/ical.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: origins.length === 1 && origins[0] === '*' ? true : origins,
    credentials: true,
  });

  await app.register(prismaPlugin);

  // 健康檢查
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  // LINE Webhook（獨立路由，不走 /api prefix）
  await app.register(lineWebhookRoutes, { prefix: '/line' });

  // iCal 日曆訂閱（不走 /api prefix，讓 TimeTree 等日曆 app 可直接存取）
  await app.register(icalRoutes, { prefix: '/cal' });

  // 所有業務路由掛在 /api
  await app.register(
    async (api) => {
      await api.register(bookingsRoutes, { prefix: '/bookings' });
      await api.register(membersRoutes, { prefix: '/members' });
      await api.register(servicesRoutes, { prefix: '/services' });
      await api.register(slotsRoutes, { prefix: '/slots' });
      await api.register(costsRoutes, { prefix: '/costs' });
      await api.register(financeRoutes, { prefix: '/finance' });
      await api.register(inventoryRoutes, { prefix: '/inventory' });
      await api.register(adminRoutes, { prefix: '/admin' });
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(serviceHistoryRoutes, { prefix: '/service-history' });
      await api.register(settingsRoutes, { prefix: '/settings' });
    },
    { prefix: '/api' }
  );

  // Production: serve frontend static files
  if (process.env.NODE_ENV === 'production') {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
    await app.register(fastifyStatic, { root: frontendDist, wildcard: false });
    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'ValidationError',
        issues: err.issues,
      });
    }
    app.log.error(err);
    const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
    return reply.status(statusCode).send({
      error: err.name || 'InternalServerError',
      message: err.message,
    });
  });

  return app;
}
