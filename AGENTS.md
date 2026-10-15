# Instrucciones para agentes

Este repositorio contiene **COMU-APP**, un monolito Next.js multi-iglesia para la gestión integral de una iglesia (creyentes, ministerios, células, reuniones, eventos, escuela, kids, finanzas y crecimiento personal). Antes de modificar código, lee este archivo y después únicamente la guía pertinente de [`docs/agents/README.md`](docs/agents/README.md). La fuente extensa de verdad es [`CONTEXTO_SISTEMA.md`](CONTEXTO_SISTEMA.md); el relato original del producto está en [`docs/BRIEF.md`](docs/BRIEF.md).

## Orden de autoridad y recuperación

1. Instrucciones actuales del usuario y del entorno.
2. Este `AGENTS.md`.
3. Código, `prisma/schema.prisma` y migraciones.
4. `CONTEXTO_SISTEMA.md` y guías de `docs/agents/`.
5. `MEMORY.md` como índice rápido.
6. `docs/BRIEF.md` como antecedente de producto.

Si documentación y código difieren, comprueba el comportamiento y actualiza la documentación en la misma tarea. No mantengas afirmaciones obsoletas.

## Invariantes que no deben romperse

- Toda lectura o mutación de negocio se aísla por el `organizationId` (iglesia) efectivo de la **sesión** (`effectiveOrgId`). Nunca aceptes el tenant del cuerpo como autoridad.
- Autorización administrativa = permiso del rol **intersectado** con lo incluido por el plan. Acceso a «lo propio» (mi ministerio, mi célula, mi libro, mis hijos) = **relación** (membresía, inscripción, tutela), validada en servidor. Ocultar un botón no autoriza una API.
- El **rol base no cambia** al servir o inscribirse: los accesos adicionales nacen de la relación, no de reasignar roles.
- `superadmin` opera sin iglesia solo en la sección Plataforma; para datos de negocio necesita una iglesia activa válida.
- El **creyente (`Member`) es la entidad central** y existe con o sin usuario (`Member.userId`). Empleados, servidores, alumnos y tutores se ligan al creyente.
- Lo inactivo no aparece en flujos operativos y su historia se conserva: se inactiva, no se borra.
- Datos de menores y su salida de Kids son sensibles: acceso mínimo y por relación.
- Totales, cupos, calificaciones y pagos se recalculan en servidor; el cliente solo propone.
- Operaciones compuestas son transaccionales e idempotentes cuando hay reintento.
- Nunca expongas secretos, hashes, tokens o credenciales en documentación, logs o respuestas. Usa nombres de variables de entorno.

## Reglas de implementación

- Reutiliza primero `src/components/base`, `src/components/ui`, el CRUD genérico y `src/lib/*/server.ts`. No crees una segunda abstracción si ya resuelven el patrón.
- Página nueva: autorización y carga inicial en servidor; interacción en un cliente de módulo; estados loading/empty/error; navegación coherente (`SYSTEM_MENUS` + `src/lib/nav.ts`). Consulta [`docs/agents/PAGINAS_Y_ARQUITECTURA.md`](docs/agents/PAGINAS_Y_ARQUITECTURA.md).
- Formularios: React Hook Form + Yup + `useFocusInvalid`; `InputGroupField`, `FormCombobox`/`OptionSelect`, pickers y `Attachment`. No uses `<select>` ni fechas nativas; hora = `TimePicker`, fecha = `DatePicker`; el teclado coincide con el dato (`tel`, `numeric`/`decimal`, `email`, `url`, `search`). Consulta [`docs/agents/FORMULARIOS_Y_CRUD.md`](docs/agents/FORMULARIOS_Y_CRUD.md).
- Avisos normales con **notistack** (`@/lib/notify`); **SweetAlert2** (`@/lib/swal`) solo para alertas de gran impacto (confirmar acciones destructivas o irreversibles, errores críticos o bloqueos).
- Overlays: usa `DialogComponent`; solo el cuerpo desplaza y header/footer permanecen visibles. No armes modales ad hoc.
- **Modal en tres partes**: encabezado (icono + nombre + leyenda), cuerpo con scroll que crece hasta casi 100 dvh y pie con las acciones finales. Cada campo lleva **icono acorde con su dato** (dinero, correo, teléfono, fecha…; `src/lib/field-icons.ts`) y el texto largo usa `TextareaField`.
- **Ancho completo**: ninguna página limita su contenido con `mx-auto max-w-*`; `DateTimePicker` y los campos llenan su celda.
- **Interactivo se nota**: todo elemento accionable tiene `cursor: pointer` y una animación mínima (base en `globals.css`, `.press` para tarjetas).
- **Búsqueda tolerante**: filtros, buscadores y selectores ignoran mayúsculas y acentos con `matchesSearch` (`src/lib/search.ts`); nunca `toLowerCase().includes()`.
- Diseño: tokens semánticos, superficies planas, `ring` antes que sombras, tipografía y densidad configurables, animación funcional y `prefers-reduced-motion`. `desk:` significa puntero fino, no simplemente ancho. Consulta [`docs/agents/DISENO_E_INTERACCION.md`](docs/agents/DISENO_E_INTERACCION.md).
- Safe areas: toda superficie fija al borde usa `env(safe-area-inset-*)`; evita sumar padding dos veces entre shell e hijo. Usa `dvh`.
- API: autentica, resuelve iglesia efectiva, comprueba scope/permiso/plan, valida entrada, ejecuta lógica en `src/lib`, responde sin filtrar datos sensibles.
- Prisma 7 (adaptador MariaDB): agrega migración versionada y seeder idempotente. Producción usa `prisma migrate deploy`; nunca `db push` ni resets sin autorización explícita. El cliente se genera en `src/generated/prisma` (ignorado por git).
- Nuevo módulo: sigue la receta de la guía de páginas (entidad → permisos → lógica → CRUD/API → página → menú → pruebas → documentación).
- **Un concepto, un módulo.** Antes de crear una pantalla, ruta o entrada de menú, busca si el concepto ya existe con otro nombre (en COMU-APP: *hogar de amor = grupo en casa = célula*; *familia* ≠ hogar de amor; los *hijos* de Kids viven en «Mi familia»). Se amplía el módulo existente; no se duplica con un nombre nuevo. Toda página sin sidebar lleva flecha de regreso.
- Conserva cambios ajenos del worktree y no reviertas archivos que no sean parte de la tarea.

## Verificación y entrega

Ejecuta en proporción al riesgo:

```bash
npm run typecheck
npm run lint -- --quiet
npm test
npm run test:integration   # requiere servidor y demo sembrada
```

Para cambios de flujos críticos agrega o actualiza pruebas (ver [`docs/agents/DESARROLLO_Y_VERIFICACION.md`](docs/agents/DESARROLLO_Y_VERIFICACION.md)). Hardware, correo, pagos, push y infraestructura requieren evidencia externa; no los declares verificados por inspección estática.

Solo crea commits o push cuando el usuario lo solicite. Si pide el flujo versionado, usa `npm run gcv -- "tipo: comentario en español"` y después `git push`; no incrementes la versión manualmente.

## Mantenimiento del contexto

Cuando cambie arquitectura, una regla de negocio, un componente canónico, un flujo o un pendiente real, actualiza en el mismo cambio:

- `CONTEXTO_SISTEMA.md` para la verdad extensa.
- La guía temática correspondiente en `docs/agents/`.
- `MEMORY.md` solo si el hecho es duradero y útil para reanudar trabajo.

No guardes en `MEMORY.md` credenciales, detalles efímeros, resultados de una sola ejecución ni listas largas de archivos.
