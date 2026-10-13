import { Prisma } from "@/generated/prisma/client";

/** true si el error es una violación de índice único (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * "get-or-create" seguro ante concurrencia: si dos requests crean a la vez el
 * mismo registro (campo @unique), el perdedor recibe P2002 y relee el que
 * ganó. Nota: en MySQL `prisma.upsert` no es atómico (hace SELECT + INSERT en
 * el cliente), así que también puede lanzar P2002; por eso se usa este patrón.
 */
export async function findOrCreate<T>(
  find: () => Promise<T | null>,
  create: () => Promise<T>
): Promise<T> {
  const existing = await find();
  if (existing) return existing;
  try {
    return await create();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const winner = await find();
    if (winner) return winner;
    throw err;
  }
}
