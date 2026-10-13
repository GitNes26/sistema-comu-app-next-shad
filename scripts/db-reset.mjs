#!/usr/bin/env node
/**
 * db-reset.mjs — Reset total de BD + seed seguro
 * ---------------------------------------------------------------------------
 * Reemplaza:  npx prisma db push --force-reset && npm run db:seed
 *
 * ¿Por qué un wrapper? El seed posterior al reset corre SIEMPRE con
 * NODE_ENV=production (semántica de producción), sin importar el NODE_ENV del
 * shell ni un SEED_DEMO="true" que se haya filtrado de un .env de desarrollo:
 * isDemoSeedingEnabled() (prisma/seeders/demo.ts) exige NODE_ENV != production,
 * así que un force-reset jamás puede terminar reconstruyendo organizaciones de
 * demo — ni siquiera en un servidor mal configurado.
 *
 * Dev: para recrear las 5 organizaciones demo después del reset, corre
 * `npm run db:seed` (idempotente, requiere SEED_DEMO="true").
 */
import { spawnSync } from "node:child_process";

const wasProduction = process.env.NODE_ENV === "production";

if (wasProduction) {
  console.warn(
    "\n⚠️  db:reset con NODE_ENV=production: se destruirán TODOS los datos de la BD.\n" +
      "    El seed posterior corre con semántica de producción (la demo queda bloqueada).\n"
  );
}

// 1) Reset físico del esquema (igual que el comando previo de db:reset)
const reset = spawnSync("npx prisma db push --force-reset", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (reset.status !== 0) {
  process.exit(reset.status ?? 1);
}

// 2) Seed SIEMPRE en modo producción → demo imposible (guard de doble opt-in)
const seed = spawnSync("npx tsx prisma/seed.ts", {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (seed.status !== 0) {
  process.exit(seed.status ?? 1);
}

if (!wasProduction) {
  console.log(
    "\nℹ️  Para recrear la demo (5 orgs) en dev: npm run db:seed (requiere SEED_DEMO=\"true\" en .env)\n"
  );
}
