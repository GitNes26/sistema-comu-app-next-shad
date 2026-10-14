# VERSIONES — COMU-APP

> Registro cronológico de versiones y progreso del sistema.
> Este archivo se actualiza **automáticamente** en cada commit (hook de Git).

## Esquema de versionado

Formato: `MAJOR.MINOR.PATCH.REVISION` (X.X.X.X)

| Nivel | Nombre | ¿Qué abarca? |
|-------|--------|--------------|
| 1º | Major | Cambios rompedores o re-arquitectura (rompen compatibilidad) |
| 2º | Minor | Nuevas funcionalidades compatibles con lo anterior |
| 3º | Patch | Corrección de bugs o mejora de funcionalidad existente |
| 4º | Revision | Ajustes finos: UI/UX, estilos, documentación, refactor |

> Al subir un dígito, los dígitos a su derecha se reinician a `0`.

## Prefijos de commit

| Prefijo | Nivel que sube | Ejemplo |
|---------|----------------|---------|
| `breaking:` / `major:` | Major (1º) | `breaking: migré la base de datos` |
| `feat:` / `feature:` | Minor (2º) | `feat: agregué el portal de clientes` |
| `fix:` / `perf:` | Patch (3º) | `fix: corregí el bug del QR` |
| `ui:` / `ux:` / `style:` | Revision (4º) | `ui: rediseñé la landing page` |
| `docs:` / `chore:` / `refactor:` / `test:` / `build:` / `ci:` | Revision (4º) | `docs: actualicé la documentación` |

---

## Historial

### [0.19.0.0] — 2026-10-14
- **Tipo:** `feat` (Minor)
- feat: reinicio de base de datos con DB_RESET una vez por version, hora actual y fecha de hoy en los selectores, letra menor en el selector de hora, flechas para desplazar filtros segmentados y leyendas en modales

### [0.18.0.0] — 2026-10-14
- **Tipo:** `feat` (Minor)
- feat: modulo de nomina propio con periodos, conceptos y recibos, flyers de publicaciones con plantillas por tipo, iconos por campo, modal en tres partes, ancho completo, interacciones visibles y busqueda sin mayusculas ni acentos

### [0.17.2.0] — 2026-10-13
- **Tipo:** `fix` (Patch)
- fix: el build en Docker no necesita DATABASE_URL (cliente de base de datos perezoso) y se pasa un valor de relleno al compilar

### [0.17.1.0] — 2026-10-13
- **Tipo:** `fix` (Patch)
- fix:se arreglo detalles del Dockerfile

### [0.17.0] — 2026-10-13
- **Tipo:** `chore` (Revision)
- Inicialización del registro de versiones.
