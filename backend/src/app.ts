import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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
import { consultationFormsRoutes } from './routes/consultationForms.js';

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

  // 安全標頭
  await app.register(helmet, {
    contentSecurityPolicy: false, // LIFF 內嵌需要，由前端 meta tag 處理
  });

  // 全域速率限制
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(prismaPlugin);

  // 健康檢查
  app.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));

  // 預約提醒診斷（不含個資，僅統計）
  app.get('/debug/reminder', async () => {
    const now = new Date();
    const twNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const tomorrowTw = new Date(twNow.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowTw.toISOString().slice(0, 10);

    // cron 舊邏輯的日期
    const cronTomorrow = new Date();
    cronTomorrow.setDate(cronTomorrow.getDate() + 1);
    const cronStr = cronTomorrow.toISOString().slice(0, 10);

    const bookings = await app.prisma.booking.findMany({
      where: { date: tomorrowStr, status: { not: '已取消' } },
      select: { id: true, phone: true, status: true },
    });

    let withOa = 0, withLiff = 0, noLine = 0, noMember = 0;
    for (const b of bookings) {
      const m = await app.prisma.member.findUnique({ where: { phone: b.phone }, select: { lineOaUserId: true, lineUserId: true } });
      if (!m) { noMember++; continue; }
      if (m.lineOaUserId) withOa++;
      else if (m.lineUserId) withLiff++;
      else noLine++;
    }

    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const hasSecret = !!process.env.LINE_CHANNEL_SECRET;

    return {
      serverUtcNow: now.toISOString(),
      taiwanNow: twNow.toISOString().slice(0, 19) + '+08:00',
      tomorrowTw: tomorrowStr,
      cronOldLogic: cronStr,
      dateMismatch: tomorrowStr !== cronStr,
      bookingsForTomorrow: bookings.length,
      withLineOa: withOa,
      withLineLiff: withLiff,
      noLineId: noLine,
      noMemberRecord: noMember,
      lineTokenSet: hasToken,
      lineSecretSet: hasSecret,
    };
  });

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
      await api.register(consultationFormsRoutes, { prefix: '/consultation-forms' });
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

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: 'ValidationError',
        issues: err.issues,
      });
    }
    app.log.error(err);
    const statusCode = err.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: err.name || 'InternalServerError',
      message: statusCode >= 500 ? '伺服器內部錯誤' : err.message,
    });
  });

  return app;
}
