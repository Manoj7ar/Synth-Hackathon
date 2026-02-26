import { PrismaClient } from '@prisma/client'

export function getPrismaDatabaseUrl() {
  return process.env.DATABASE_URL
}

export function createPrismaClient() {
  return new PrismaClient()
}

const globalForPrisma = globalThis as typeof globalThis & {
  __synthPrisma?: PrismaClient
}

export const prisma = globalForPrisma.__synthPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__synthPrisma = prisma
}

