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

### [0.28.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: paleta de marca azul con apoyo cian, tarjetas de libro compactas, safe areas laterales en el portal y Mi espacio menos saturado con secciones plegadas

### [0.27.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: Mi espacio con columna lateral para novedades, agenda y semana en casa compactas, y Mi camino con mas protagonismo

### [0.26.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: Mi espacio como tablero con portada, hitos y accesos rapidos, Mis ministerios con tarjetas y cifras, encabezado comun en las paginas del portal

### [0.25.1.0] — 2026-10-15
- **Tipo:** `fix` (Patch)
- fix: un solo lugar para hogar de amor y familia sin duplicados, flecha de regreso en paginas sin sidebar y panel de bienvenida redisenado con lo de hoy y accesos por zonas

### [0.25.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: buscador de hogares de amor publico y del portal sin duplicar celulas, familias del padron, catalogo de la escuela con tarjetas de portada y pagina de cada libro

### [0.24.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: recibos de donativo en PDF con folio e importe con letra, trayecto de Teologia por puntos con credenciales por ano, mi trayecto y puntos en campus y aula

### [0.23.0.0] — 2026-10-15
- **Tipo:** `feat` (Minor)
- feat: campanas de donativos para ComuniDAR con meta y vigencia, aula del maestro con siguiente clase y alumnos en atencion, flujos documentados y arranque de base de datos que no tumba el contenedor

### [0.22.0.0] — 2026-10-14
- **Tipo:** `feat` (Minor)
- feat: boleto con diseno de boleto, campus del alumno con navegacion y avance, mis hijos como lugar seguro, avisos en vivo para boletos pagos calificaciones y ministerios sin notificaciones de demostracion

### [0.21.0.0] — 2026-10-14
- **Tipo:** `feat` (Minor)
- feat: organigrama con ministerios y areas de servicio, niveles jerarquicos nuevos, estructura base y demo con VTR Saetas y Hombres de Reino, circulo de crecimiento, flyers con estructuras distintas y vista previa fija, calendario de la iglesia y calificacion con la interfaz de cada respuesta

### [0.20.0.0] — 2026-10-14
- **Tipo:** `feat` (Minor)
- feat: cara publica de bienvenida con horarios y modalidad, tarjeta de conexion Soy nuevo hacia consolidacion, bandeja y oracion, tu semana en casa, tonos azul comunidad y dorado y voz de casa

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
