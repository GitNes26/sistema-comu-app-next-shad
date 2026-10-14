#!/usr/bin/env node
/**
 * db-bootstrap.mjs — Arranque de base de datos del contenedor
 * ---------------------------------------------------------------------------
 * Flujo normal:   prisma migrate deploy  →  seed idempotente.
 *
 * Con DB_RESET="true" (cambio importante que afecta registros existentes):
 *   1. Borra TODA la base y la vuelve a levantar desde las migraciones
 *      (`prisma migrate reset --force --skip-seed`).
 *   2. Ejecuta el seed: producción siempre; la demo solo si además SEED_DEMO="true".
 *   3. Anota la versión de la app en `_db_resets`: el reinicio es de UNA vez por
 *      versión desplegada, de modo que reiniciar el contenedor con la variable
 *      todavía activa NO vuelve a borrar los datos.
 *
 * Quita DB_RESET del entorno después del despliegue.
 */
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import mariadb from "mariadb"

const run = (cmd, env = {}) => {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", env: { ...process.env, ...env } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version
const wantsReset = process.env.DB_RESET === "true"

async function connect() {
  const url = new URL(process.env.DATABASE_URL ?? "")
  return mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  })
}

async function alreadyResetFor(v) {
  const conn = await connect()
  try {
    await conn.query("CREATE TABLE IF NOT EXISTS `_db_resets` (`version` VARCHAR(40) PRIMARY KEY, `at` DATETIME NOT NULL)")
    const rows = await conn.query("SELECT `version` FROM `_db_resets` WHERE `version` = ?", [v])
    return rows.length > 0
  } finally {
    await conn.end()
  }
}

async function markReset(v) {
  const conn = await connect()
  try {
    await conn.query("CREATE TABLE IF NOT EXISTS `_db_resets` (`version` VARCHAR(40) PRIMARY KEY, `at` DATETIME NOT NULL)")
    await conn.query("INSERT IGNORE INTO `_db_resets` (`version`, `at`) VALUES (?, NOW())", [v])
  } finally {
    await conn.end()
  }
}

if (wantsReset && !(await alreadyResetFor(version))) {
  console.warn(`\n⚠️  DB_RESET=true: se BORRA toda la base y se levanta de nuevo (versión ${version}).\n`)
  run("npx prisma migrate reset --force --skip-seed")
  run("npm run db:seed")
  await markReset(version)
  console.log(`\n✔ Base reiniciada para la versión ${version}. Quita DB_RESET del entorno.\n`)
} else {
  if (wantsReset) console.log(`DB_RESET=true, pero la base ya se reinició en la versión ${version}; se conserva. Quita la variable.`)
  run("npx prisma migrate deploy")
  run("npm run db:seed")
}
