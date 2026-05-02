import type { FastifyInstance } from 'fastify';
import { adminAuth } from '../middleware/adminAuth.js';
import { consultationFormSchema } from '../schemas/consultationForm.js';

export async function consultationFormsRoutes(app: FastifyInstance) {
  // POST /consultation-forms — customer submit
  app.post('/', async (req) => {
    const input = consultationFormSchema.parse(req.body);
    const form = await app.prisma.consultationForm.upsert({
      where: { phone: input.phone },
      update: { ...input, hairRemoval: input.hairRemoval },
      create: { ...input, hairRemoval: input.hairRemoval },
    });
    return { form };
  });

  // GET /consultation-forms/:phone — admin view by phone
  app.get<{ Params: { phone: string } }>(
    '/:phone',
    { preHandler: adminAuth },
    async (req, reply) => {
      const form = await app.prisma.consultationForm.findFirst({
        where: { phone: req.params.phone },
        orderBy: { updatedAt: 'desc' },
      });
      if (!form) return reply.status(404).send({ error: 'NotFound' });
      return { form };
    }
  );

  // GET /consultation-forms/mine/:phone — customer view own form
  app.get<{ Params: { phone: string } }>('/mine/:phone', async (req, reply) => {
    const form = await app.prisma.consultationForm.findFirst({
      where: { phone: req.params.phone },
      orderBy: { updatedAt: 'desc' },
    });
    if (!form) return reply.status(404).send({ error: 'NotFound' });
    return { form };
  });
}
