import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { getFinanceSummary } from '../services/financeService.js';

export async function financeRoutes(app: FastifyInstance) {
  app.get('/summary', { preHandler: adminAuth }, async () => {
    return getFinanceSummary(app.prisma);
  });
}
