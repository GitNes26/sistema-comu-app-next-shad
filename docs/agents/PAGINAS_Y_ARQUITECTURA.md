# Páginas, arquitectura y scaffolding

## Capas esperadas

```text
page/layout (server) → cliente de módulo → /api route → lib/<dominio>/server → Prisma
                                         ↘ reglas puras reutilizables (sin Prisma)
```

- La página resuelve sesión, iglesia, acceso y datos iniciales.
- El cliente contiene interacción y estado visual, no reglas de negocio.
- El route handler autentica y autoriza antes de leer input; delega la operación de dominio.
- `src/lib/<dominio>/server.ts` valida pertenencia al tenant y concentra transacciones.
- Cálculos y reglas puras viven en archivos sin Prisma para probarse unitariamente.
- `src/proxy.ts` (antes middleware, Next 16) es la primera barrera; cada página y API repite su comprobación.

## Dos superficies

| Superficie | Ruta | Quién | Cómo se autoriza |
|---|---|---|---|
| Panel administrativo | `/admin/**` | owner, admin, leader, servant, superadmin | permiso del rol ∩ plan |
| Mi espacio | `/mi` | cualquier sesión (creyente, líderes, admins) | por sesión: solo ve lo propio |

Un creyente (`scope: "portal"`) que abre `/admin` es redirigido a `/mi`; el CRUD responde 403.

## Acceso por rol y por relación

- **Rol (nivel + permisos)**: `OrgRole` en `Membership.role` y `Role` configurable (`Membership.roleId`). Catálogo en `src/lib/auth/permission-keys.ts`, roles de sistema en `src/lib/auth/system-roles.ts`.
- **Relación**: pertenecer a un ministerio, estar inscrito en un libro, ser tutor de un niño. Da acceso a lo propio sin tocar el rol: el servidor comprueba la relación (`userId → Member → relación`) en cada consulta.
- **Puesto ≠ rol**: el puesto (`EmployeePosition`, responsabilidades como Directora de Kids) describe qué hace la persona; el rol define qué puede ver y hacer en el sistema.
- Un menú «Mi ministerio» o «Mi escuela» aparece cuando existe la relación, no por permiso.
- Patrón de referencia: `src/lib/ministries/server.ts` (`Actor` + `ministryAccess`): permiso global ∪ papel en la entidad (propio o heredado del padre); lo ajeno responde 404. El espacio de trabajo se comparte entre `/admin/ministries/[id]` y `/mi/ministerios/[id]`.
- Un creyente puede acumular varios papeles a la vez (varios ministerios, red, célula…): modela cada uno como una fila de relación con su papel, nunca como un rol único.

## Crear un módulo nuevo (receta)

1. **Entidad**: modelo Prisma con `organizationId`, `isActive`, timestamps e índices tenant; migración versionada.
2. **Permisos**: agrega `modulo.view`/`modulo.manage` en `permission-keys.ts`; asígnalos en `SYSTEM_ROLES`; etiqueta en `PERMISSION_MODULE_LABELS`; El seeder incorpora una sola vez los permisos nuevos a los planes que ya guardaron una lista (si no, el módulo nuevo queda bloqueado por plan); en una base que ya sembró esos permisos hay que aplicar ese ajuste a mano.
3. **Lógica**: `src/lib/<dominio>/server.ts` (consultas con `organizationId`, transacciones, relaciones cruzadas validadas) y reglas puras.
4. **API/CRUD**: si es catálogo, `CrudModule` en `src/lib/crud/modules/` + entrada en `CRUD_MODULES` + configuración de UI en `crud-config.ts`; si no, ruta propia con el orden obligatorio.
5. **Página**: `/admin/<módulo>` (servidor con permiso) + cliente con `PageHeader`, herramientas (`type="search"`, filtros, `ClearFiltersButton`), `DataTable`, estados.
   El contenedor de la página ocupa **todo el ancho disponible** (sin `mx-auto max-w-*`); consulta la regla de ancho en la guía de diseño. Formularios con icono por campo y modales con encabezado/cuerpo/pie (ver guía de formularios).
6. **Menú**: ítem en `SYSTEM_MENUS` (seeder) + fallback en `src/lib/nav.ts` con `permissionKey` e ícono; `features.ts` si aplica.
7. **Pruebas**: regla pura en `tests/unit`, caso de permisos en `tests/permissions.integration.test.mjs`.
8. **Documentación**: `CONTEXTO_SISTEMA.md`, esta guía si hay convención nueva, `MEMORY.md` solo si es duradero.

## Crear una API

Orden obligatorio:

1. `getServerSession(authOptions)`.
2. Rechazar scope incorrecto.
3. `effectiveOrgId(session)`; global solo cuando la función sea realmente global (Plataforma).
4. `hasPermission`/`assertPermission`, incluyendo `planDenied`; o relación para lo propio.
5. Parsear y validar límites, enums e IDs.
6. Consultar siempre con `organizationId`; validar relaciones cruzadas.
7. Ejecutar lógica/transacción de dominio.
8. Errores esperados con 4xx y mensaje accionable; internos sin datos sensibles.

Cuidado con los guards: devuelven `{ response }` o el contexto; comprueba con `"response" in guard`, nunca `!guard`.

## Server y client components

- Server Component para shell, autorización y primera carga; `"use client"` en la frontera mínima.
- No importes `server.ts`, Prisma ni `@/lib/db` desde cliente (rompe el build). Las constantes compartidas viven en módulos puros (p. ej. `src/lib/app-settings-defaults.ts`).
- `Decimal`, `Date` y enums se normalizan antes de cruzar la frontera.

## Navegación, funcionalidades y planes

- `src/lib/features.ts` declara funcionalidades; `src/lib/nav.ts` es fallback; el menú normal viene de BD (`SYSTEM_MENUS`) y se filtra por permiso y plan.
- Un enlace visible requiere permiso de rol y permiso incluido en el plan. La página y la API repiten la autorización.
- Rutas solo-superadmin viven en la sección Plataforma y no dependen de una iglesia activa.

## Operaciones entre dominios

Antes de mutar pregunta qué registros afecta: asistencia, pagos, inscripciones, notificaciones, reportes. Si dos efectos son una sola acción, comparten transacción o una estrategia idempotente. No borres historia: inactiva y conserva snapshots descriptivos.

## Antes de crear una pantalla: ¿ya existe el concepto?

Revisa `src/lib/nav.ts`, `CONTEXTO_SISTEMA.md` (vocabulario) y el menú del seeder. Si el concepto existe con otro nombre, **extiéndelo** (otra pestaña, otra sección) y deja una redirección en la ruta vieja. Ejemplos ya resueltos: buscador de hogares dentro de «Mi hogar de amor»; «Mis hijos» dentro de «Mi familia». Al retirar una entrada de menú, agrégala a `RETIRED_MENU_IDS` del seeder para que se desactive en las bases existentes.
