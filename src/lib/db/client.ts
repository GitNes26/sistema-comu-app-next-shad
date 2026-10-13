import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "@/generated/prisma/client"

// Prisma 7: el cliente usa un adaptador de controlador (MySQL/MariaDB).
// `DATABASE_URL` conserva el formato mysql://usuario:clave@host:puerto/base.
function createClient() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error("DATABASE_URL no está definida")
  const url = new URL(raw)
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 10,
  })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function instance(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient()
  return globalForPrisma.prisma
}

/**
 * El cliente se crea la primera vez que se usa, no al importar el módulo: así `next build`
 * puede cargar las rutas sin base de datos (p. ej. dentro de Docker) y solo falla si de
 * verdad se intenta consultar sin `DATABASE_URL`.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = instance()
    const value = Reflect.get(client, prop, client)
    return typeof value === "function" ? value.bind(client) : value
  },
  has(_target, prop) {
    return Reflect.has(instance(), prop)
  },
})
