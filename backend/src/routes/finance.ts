import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  getFinanceSummary,
  getYearSummary,
  getMonthSummary,
} from '../services/financeService.js';
import { getAnalytics } from '../services/analyticsService.js';

const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100) });
const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

export async function financeRoutes(app: FastifyInstance) {
  app.get('/summary', { preHandler: adminAuth }, async () => {
    return getFinanceSummary(app.prisma);
  });

  // 指定年度的營收摘要（含 12 個月份分類、可用年份清單）
  app.get('/year', { preHandler: adminAuth }, async (req) => {
    const { year } = yearQuery.parse(req.query);
    return getYearSummary(app.prisma, year);
  });

  // 指定月份的完整財務摘要（含付款方式分類）
  app.get('/month', { preHandler: adminAuth }, async (req) => {
    const { month } = monthQuery.parse(req.query);
    return getMonthSummary(app.prisma, month);
  });

  // 數據分析：本月總預約數、熱門時段、熱門服務
  app.get('/analytics', { preHandler: adminAuth }, async () => {
    return getAnalytics(app.prisma);
  });
}
