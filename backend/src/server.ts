import 'dotenv/config';
import { buildApp } from './app.js';
import { startReminderScheduler } from './services/reminderScheduler.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const app = await buildApp();

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`shanshan-studio backend listening on http://${HOST}:${PORT}`);

  // 啟動每日預約提醒排程
  startReminderScheduler(app.prisma);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
