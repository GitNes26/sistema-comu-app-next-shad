#!/usr/bin/env node
/**
 * version-bump.mjs
 * ---------------------------------------------------------------------------
 * Actualiza la versión del proyecto (MAJOR.MINOR.PATCH.REVISION) y el archivo
 * VERSION.md a partir del mensaje de commit (Conventional Commits ligero).
 *
 * Uso:
 *   node scripts/version-bump.mjs <archivo-de-mensaje>   # desde hook commit-msg
 *   node scripts/version-bump.mjs --init                  # genera VERSION.md base
 *   npm run version:bump -- "feat: nueva funcionalidad"   # manual
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
  major: { index: 0, name: "Major", desc: "Cambio rompedor / re-arquitectura" },
  minor: { index: 1, name: "Minor", desc: "Nueva funcionalidad" },
  patch: { index: 2, name: "Patch", desc: "Corrección / mejora de funcionalidad" },
  revision: { index: 3, name: "Revision", desc: "Ajustes finos (UI/UX, docs, refactor)" },
}

// Mapeo de prefijo → nivel
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
  console.log(`[version] VERSION.md creado (${version})`)
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

function stageFiles() {
  try {
    execSync(`git add "${PKG_PATH}" "${LOCK_PATH}" "${VERSION_PATH}"`, { cwd: ROOT, stdio: "ignore" })
  } catch {
    // Si no es un repo git o falla el add, no bloquear el commit.
  }
}

function readCommitMessage() {
  // Desde el hook commit-msg, el primer argumento es la ruta al archivo del mensaje.
  const arg = process.argv[2]
  if (arg && arg !== "--init" && existsSync(arg)) {
    return readFileSync(arg, "utf8")
  }
  // Uso manual: `npm run version:bump -- "mensaje"`
  if (arg && arg !== "--init") return arg
  // Último recurso: leer el último commit.
  try {
    return execSync("git log -1 --pretty=%B", { cwd: ROOT, encoding: "utf8" })
  } catch {
    return ""
  }
}

function main() {
  const currentPkg = JSON.parse(readFileSync(PKG_PATH, "utf8"))
  const current = currentPkg.version

  // ── Modo init: solo genera el archivo base ─────────────────────────────
  if (process.argv.includes("--init")) {
    ensureVersionFile(current)
    console.log(`[version] Registro inicializado en ${current}`)
    return
  }

  const rawMessage = readCommitMessage().trim()
  if (!rawMessage) {
    console.log("[version] Sin mensaje de commit, se omite el bump.")
    return
  }

  const firstLine = rawMessage.split("\n")[0].trim()
  const prefix = parsePrefix(firstLine)
  const level = levelForPrefix(prefix)
  const levelInfo = LEVELS[level]
  const next = bumpVersion(current, level)

  if (next === current) {
    console.log("[version] La versión no cambió.")
    return
  }

  setPackageVersion(next)
  ensureVersionFile(current)
  addEntry(next, levelInfo.name, prefix ?? "chore", firstLine)
  stageFiles()

  console.log(`[version] ${current} → ${next} (${levelInfo.name}) — "${firstLine}"`)
}

main()
