#!/usr/bin/env node
/**
 * db-bootstrap.mjs — Arranque de base de datos del contenedor
 * ---------------------------------------------------------------------------
 * Flujo normal:   prisma migrate deploy  →  seed idempotente.
 *
 * Con DB_RESET="true" (cambio importante que afecta registros existentes):
 *   1. Borra TODAS las tablas de la base (no la base: no exige permiso DROP DATABASE).
 *   2. Las vuelve a crear con las migraciones y corre el seed: producción siempre; la
 *      demo solo si además SEED_DEMO="true".
 *   3. Anota la versión de la app en `_db_resets`: el reinicio es de UNA vez por
 *      versión desplegada; reiniciar el contenedor con la variable activa NO vuelve a
 *      borrar los datos.
 *
 * Es defensivo: si el reinicio falla (permisos, conexión…) lo dice con claridad y sigue
 * con el arranque normal en lugar de tumbar el contenedor (que se vería como 502).
 * Quita DB_RESET del entorno después del despliegue.
 */
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import mariadb from "mariadb"

const log = (m) => console.log(`[db-bootstrap] ${m}`)
const warn = (m) => console.warn(`[db-bootstrap] ⚠️  ${m}`)

/** Ejecuta un comando; devuelve true si terminó bien. */
const run = (cmd) => spawnSync(cmd, { shell: true, stdio: "inherit", env: process.env }).status === 0

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
    multipleStatements: false,
  })
}

const MARKER_DDL = "CREATE TABLE IF NOT EXISTS `_db_resets` (`version` VARCHAR(40) PRIMARY KEY, `at` DATETIME NOT NULL)"

async function alreadyResetFor(v) {
  const conn = await connect()
  try {
    await conn.query(MARKER_DDL)
    const rows = await conn.query("SELECT `version` FROM `_db_resets` WHERE `version` = ?", [v])
    return rows.length > 0
  } finally {
    await conn.end()
  }
}

async function dropAllTables() {
  const conn = await connect()
  try {
    const rows = await conn.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'")
    await conn.query("SET FOREIGN_KEY_CHECKS = 0")
    for (const r of rows) await conn.query(`DROP TABLE IF EXISTS \`${String(r.name).replace(/`/g, "")}\``)
    await conn.query("SET FOREIGN_KEY_CHECKS = 1")
    log(`${rows.length} tablas eliminadas.`)
  } finally {
    await conn.end()
  }
}

async function markReset(v) {
  const conn = await connect()
  try {
    await conn.query(MARKER_DDL)
    await conn.query("INSERT IGNORE INTO `_db_resets` (`version`, `at`) VALUES (?, NOW())", [v])
  } finally {
    await conn.end()
  }
}

let resetDone = false
if (wantsReset) {
  try {
    if (await alreadyResetFor(version)) {
      log(`DB_RESET=true, pero la base ya se reinició en la versión ${version}; se conserva. Quita la variable.`)
    } else {
      warn(`DB_RESET=true: se BORRAN todas las tablas y se levanta la base de nuevo (versión ${version}).`)
      await dropAllTables()
      resetDone = true
    }
  } catch (err) {
    warn(`No se pudo reiniciar la base (${err instanceof Error ? err.message : err}). Se continúa con el arranque normal.`)
  }
}

log("Aplicando migraciones…")
if (!run("npx prisma migrate deploy")) {
  console.error("[db-bootstrap] ❌ Falló `prisma migrate deploy`: la aplicación no puede arrancar sin su esquema.")
  process.exit(1)
}

log("Sembrando datos base…")
if (!run("npm run db:seed")) {
  // El seed es idempotente; si falla, la app aún puede servir con lo que ya hay.
  warn("El seed terminó con error; la aplicación arranca con los datos existentes.")
}

if (resetDone) {
  try {
    await markReset(version)
    log(`✔ Base reiniciada para la versión ${version}. Quita DB_RESET del entorno.`)
  } catch (err) {
    warn(`No se pudo anotar el reinicio: ${err instanceof Error ? err.message : err}`)
  }
}
