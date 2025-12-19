import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create PostgreSQL connection pool
let connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Ensure UTF-8 encoding is set in connection string
// Add client_encoding=UTF8 if not already present
if (!connectionString.includes('client_encoding')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}client_encoding=UTF8`;
}

const pool = new Pool({ 
  connectionString,
});

// Ensure all connections use UTF-8 encoding (backup method)
pool.on('connect', async (client) => {
  try {
    await client.query('SET client_encoding TO UTF8');
  } catch (error) {
    // Silently fail - encoding might already be set via connection string
  }
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
