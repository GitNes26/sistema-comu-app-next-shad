# Desarrollo, datos, pruebas y entrega

## Entorno local

```bash
cp .env.example .env            # completa DATABASE_URL y NEXTAUTH_SECRET
npm install                     # postinstall genera el cliente Prisma
npx prisma migrate deploy       # o `npm run db:migrate` en desarrollo
SEED_DEMO=true npm run db:seed  # base + iglesia demo (solo desarrollo)
npm run dev
```

- Base: MySQL 8 (`DATABASE_URL=mysql://usuario:clave@host:3306/db_comu_app`).
- `NEXTAUTH_URL` debe coincidir con el puerto donde corres la app (si usas `-p 3100`, ponlo en `.env`).
- Superadmin: `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` (el seeder lo crea solo si ambos existen).
- Demo: usuarios `demo.*@comuapp.test`; contraseña común `DEMO_PASSWORD` (valor de desarrollo en `prisma/seeders/demo.ts`).

## Antes de editar

1. `git status --short` y `git log -5 --oneline`.
2. Busca con `rg`; identifica la implementación canónica y consumidores.
3. Revisa schema/migración si toca datos y permiso/plan/feature si toca acceso.
4. Define impactos transversales: historial, asistencia, pagos, notificaciones, reportes, Mi espacio.
5. Conserva cambios ajenos; si se solapan, integra deliberadamente.

## Prisma y migraciones

- Cambia `prisma/schema.prisma` y crea migración con `npx prisma migrate dev --name <cambio>`; versiona la carpeta generada.
- Producción: `prisma migrate deploy`; nunca `db push` ni reset.
- Prisma 7: URL en `prisma.config.ts`, cliente en `src/generated/prisma` (ignorado), adaptador `@prisma/adapter-mariadb` en `src/lib/db/client.ts`. Tras cambiar el schema: `npx prisma generate`.
- Seeders idempotentes y sin secretos literales (credenciales por env). La demo exige `SEED_DEMO=true` y `NODE_ENV != production`.
- `db:reset` es destructivo: solo con autorización y destino resuelto.
- Al cambiar tipo/relación, migra datos existentes o documenta por qué no hay backfill seguro.

## Pruebas


| Cambio                    | Mínimo                                                  |
| --------------------------- | ---------------------------------------------------------- |
| Tipos/UI local            | `npm run typecheck`, `npm run lint -- --quiet`           |
| Regla pura                | prueba en`tests/unit/*.test.mjs` + `npm test`            |
| API/permisos              | `npm run test:integration` (servidor + demo sembrada)    |
| Schema/seeder             | base nueva, migraciones, seed idempotente (dos corridas) |
| Flujo crítico/responsive | recorrido manual en móvil y escritorio                  |

Notas de herramientas: TypeScript 6 (typescript-eslint aún no soporta 7), `@tanstack/react-table` 8 (la 9 cambió la API), `nodemailer` 7 (peer de next-auth 4). Las reglas del compilador de React están en `warn`: no introduzcas patrones nuevos que las disparen.

## Revisión manual

- Camino feliz, vacío, loading, error, permiso denegado y doble clic/reintento.
- Móvil pequeño, tablet táctil, escritorio con mouse, landscape y teclado virtual.
- Tema claro/oscuro, densidad, texto largo.
- Diálogo: header/footer visibles, body desplaza, foco en el primer inválido.
- Operación: comprueba BD e historial, no solo el toast.

## Integraciones externas

Correo SMTP, push, QR/cámara, GPS, YouTube/Facebook y pagos requieren validación en su ambiente o dispositivo. Se puede verificar el manejo de error local, pero no declarar la integración completa sin evidencia externa.

## Versionado y entrega

- No commit/push sin solicitud explícita.
- Flujo GCV: `npm run gcv -- "feat|fix|docs|...: comentario en español"` (agrega, commitea y actualiza versión según `VERSION.md`); después `git push`.
- Despliegue: `Dockerfile` ejecuta `prisma migrate deploy` + seed de producción al arrancar; `docker-compose.yml` lee todos los secretos del entorno.
- El resumen final menciona resultado, verificaciones y limitaciones reales.

## Actualización de contexto

Actualiza `CONTEXTO_SISTEMA.md`, la guía temática y `MEMORY.md` cuando cambie una decisión duradera. No actualices memoria por refactors internos sin impacto, datos locales, credenciales ni resultados que caducan.
