import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  const db = new Database('prisma/dev.db');
  const adapter = new PrismaBetterSqlite3(db);
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalForPrisma.prisma) {
    const db = new Database('prisma/dev.db');
    const adapter = new PrismaBetterSqlite3(db);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
