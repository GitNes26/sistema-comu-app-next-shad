#!/usr/bin/env node
/**
 * gcv.mjs — Git Commit + Version
 * ---------------------------------------------------------------------------
 * Wrapper que reemplaza:  git add . && git commit -m "mensaje"
 *
 * Flujo:
 *   1. git add .
 *   2. git commit -m "mensaje"     ← crea el commit
 *   3. (espera a que termine)       ← sin race conditions
 *   4. Bump de versión + stageo
 *   5. git commit --amend           ← incluye la versión en el commit
 *
 * Uso:
 *   node scripts/gcv.mjs "fix: descripción del cambio"
 *   npm run gcv -- "fix: descripción del cambio"
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const PKG_PATH = join(ROOT, "package.json")
const LOCK_PATH = join(ROOT, "package-lock.json")
const VERSION_PATH = join(ROOT, "VERSION.md")

// ── Niveles de versión ─────────────────────────────────────────────────────
const LEVELS = {
  major: { index: 0, name: "Major" },
  minor: { index: 1, name: "Minor" },
  patch: { index: 2, name: "Patch" },
  revision: { index: 3, name: "Revision" },
}

const PREFIX_MAP = {
  breaking: "major",
  major: "major",
  feat: "minor",
  feature: "minor",
  fix: "patch",
  perf: "patch",
  ui: "revision",
  ux: "revision",
  style: "revision",
  docs: "revision",
  chore: "revision",
  refactor: "revision",
  test: "revision",
  build: "revision",
  ci: "revision",
}

function parsePrefix(message) {
  const m = message.match(
    /^(breaking|major|feature|feat|fix|perf|ui|ux|style|docs|chore|refactor|test|build|ci)(\s*\([^)]*\))?\s*:/i
  )
  if (!m) return null
  return m[1].toLowerCase()
}

function levelForPrefix(prefix) {
  if (!prefix) return "revision"
  return PREFIX_MAP[prefix] ?? "revision"
}

function bumpVersion(version, level) {
  const parts = version.split(".").map((n) => parseInt(n, 10) || 0)
  while (parts.length < 4) parts.push(0)
  const { index } = LEVELS[level]
  parts[index] += 1
  for (let i = index + 1; i < 4; i++) parts[i] = 0
  return parts.slice(0, 4).join(".")
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function setPackageVersion(version) {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"))
  pkg.version = version
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n")

  if (existsSync(LOCK_PATH)) {
    const lock = JSON.parse(readFileSync(LOCK_PATH, "utf8"))
    if (lock.version !== undefined) lock.version = version
    if (lock.packages?.[""]?.version !== undefined) lock.packages[""].version = version
    writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + "\n")
  }
}

const VERSION_HEADER = `# VERSIONES — COMU-APP

> Registro cronológico de versiones y progreso del sistema.
> Este archivo se actualiza **automáticamente** en cada commit (hook de Git).

## Esquema de versionado

Formato: \`MAJOR.MINOR.PATCH.REVISION\` (X.X.X.X)

| Nivel | Nombre | ¿Qué abarca? |
|-------|--------|--------------|
| 1º | Major | Cambios rompedores o re-arquitectura (rompen compatibilidad) |
| 2º | Minor | Nuevas funcionalidades compatibles con lo anterior |
| 3º | Patch | Corrección de bugs o mejora de funcionalidad existente |
| 4º | Revision | Ajustes finos: UI/UX, estilos, documentación, refactor |

> Al subir un dígito, los dígitos a su derecha se reinician a \`0\`.

## Prefijos de commit

| Prefijo | Nivel que sube | Ejemplo |
|---------|----------------|---------|
| \`breaking:\` / \`major:\` | Major (1º) | \`breaking: migré la base de datos\` |
| \`feat:\` / \`feature:\` | Minor (2º) | \`feat: agregué el portal de clientes\` |
| \`fix:\` / \`perf:\` | Patch (3º) | \`fix: corregí el bug del QR\` |
| \`ui:\` / \`ux:\` / \`style:\` | Revision (4º) | \`ui: rediseñé la landing page\` |
| \`docs:\` / \`chore:\` / \`refactor:\` / \`test:\` / \`build:\` / \`ci:\` | Revision (4º) | \`docs: actualicé la documentación\` |

---

## Historial
`

function ensureVersionFile(version) {
  if (existsSync(VERSION_PATH)) return
  const content =
    VERSION_HEADER +
    `\n### [${version}] — ${today()}\n- **Tipo:** \`chore\` (Revision)\n- Inicialización del registro de versiones.\n`
  writeFileSync(VERSION_PATH, content, "utf8")
}

function addEntry(version, levelName, prefix, message) {
  let content = existsSync(VERSION_PATH) ? readFileSync(VERSION_PATH, "utf8") : VERSION_HEADER
  const anchor = "## Historial"
  const idx = content.indexOf(anchor)
  const entry =
    `\n### [${version}] — ${today()}\n` +
    `- **Tipo:** \`${prefix}\` (${levelName})\n` +
    `- ${message}\n`
  if (idx === -1) {
    content = content.trimEnd() + "\n\n" + anchor + entry
  } else {
    const insertAt = content.indexOf("\n", idx) + 1
    content = content.slice(0, insertAt) + entry + content.slice(insertAt)
  }
  writeFileSync(VERSION_PATH, content, "utf8")
}

function git(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: "inherit" })
}

// ── Main ───────────────────────────────────────────────────────────────────
const message = process.argv[2]
if (!message) {
  console.error("Uso: node scripts/gcv.mjs \"fix: descripción\"")
  console.error("     npm run gcv -- \"fix: descripción\"")
  process.exit(1)
}

// 1. git add .
console.log("📦 git add .")
git("git add .")

// 2. git commit -m "mensaje"
console.log(`📝 git commit -m "${message}"`)
git(`git commit -m "${message}"`)

// 3. Esperar un momento para que git libere los locks
await new Promise((r) => setTimeout(r, 500))

// 4. Bump de versión
const currentPkg = JSON.parse(readFileSync(PKG_PATH, "utf8"))
const current = currentPkg.version
const firstLine = message.split("\n")[0].trim()
const prefix = parsePrefix(firstLine)
const level = levelForPrefix(prefix)
const levelInfo = LEVELS[level]
const next = bumpVersion(current, level)

if (next === current) {
  console.log("ℹ️  La versión no cambió.")
  process.exit(0)
}

setPackageVersion(next)
ensureVersionFile(current)
addEntry(next, levelInfo.name, prefix ?? "chore", firstLine)

// 5. Stagear archivos de versión
console.log("📄 Staging version files...")
execSync(`git add "${PKG_PATH}" "${LOCK_PATH}" "${VERSION_PATH}"`, { cwd: ROOT, stdio: "ignore" })

// 6. Amendar el commit (ya sin race condition porque el commit anterior terminó)
console.log("🔧 Amending commit...")
git("git commit --amend --no-verify --no-edit")

console.log(`\n✅ ${current} → ${next} (${levelInfo.name}) — Listo para push ✓`)
