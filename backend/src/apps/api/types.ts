declare module "fastify" {
  interface FastifyRequest {
    principal: { userId: string; email?: string };
  }
}

export {};
