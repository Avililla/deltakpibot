import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Si ya existe una instancia, reutilízala. Si no, crea una nueva.
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "info", "warn", "error"], // Opcional: logs útiles en desarrollo
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma; // Reutilizar en desarrollo para evitar múltiples instancias
}

export default prisma;
