import type { FastifyReply, FastifyRequest } from 'fastify';

export async function adminAuth(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return reply.status(500).send({
      error: 'ServerMisconfigured',
      message: 'ADMIN_TOKEN is not set on the server',
    });
  }
  const token = req.headers['x-admin-token'];
  if (typeof token !== 'string' || token !== expected) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
