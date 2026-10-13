# COMU-APP

Sistema de gestión integral para iglesias: creyentes, ministerios, células, reuniones, eventos, escuela, kids, finanzas y crecimiento personal. Multi-iglesia, con panel administrativo y espacio personal para cada creyente.

Contexto para quien desarrolla: [`AGENTS.md`](AGENTS.md) · [`CONTEXTO_SISTEMA.md`](CONTEXTO_SISTEMA.md) · [`docs/agents/`](docs/agents/README.md).

## Requisitos

- Node.js 22+ y npm
- MySQL 8 (por defecto `localhost:3306`)

## Puesta en marcha

```bash
cp .env.example .env       # define DATABASE_URL y NEXTAUTH_SECRET
npm install                # genera el cliente Prisma
npx prisma migrate deploy  # crea el esquema
npm run db:seed            # permisos, roles, menús y plan por defecto
npm run dev
```

Superadmin: define `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` antes del seed. Datos de demostración (solo desarrollo): `SEED_DEMO=true npm run db:seed`.

## Configuración opcional

Todo esto es opcional: sin configurarlo, el sistema funciona y la pantalla correspondiente avisa qué falta.

| Función | Variables | Notas |
|---|---|---|
| Correo (bienvenida, recuperación, reportes programados) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Puerto 587 con STARTTLS o 465 |
| Notificaciones push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Genera las llaves con `npm run vapid:generate`; sin ellas el botón de push no aparece |
| Pagos en línea (Stripe, Mercado Pago) | `PAYMENTS_SECRET_KEY` | Cifra las credenciales de cada iglesia; defínela **antes** de guardarlas. Cada iglesia conecta su cuenta en Finanzas → Donativos |
| Envío programado de reportes | `REPORT_SCHEDULER`, `CRON_SECRET` | Planificador interno cada 5 min (`REPORT_SCHEDULER=off` lo apaga); `POST /api/cron/reports` con `Authorization: Bearer $CRON_SECRET` para un cron externo |

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run typecheck` / `npm run lint` | Tipos y estilo |
| `npm test` | Pruebas unitarias |
| `npm run test:integration` | Permisos por HTTP (servidor + demo sembrada) |
| `npm run db:migrate` / `db:deploy` | Migraciones (desarrollo / producción) |
| `npm run db:seed` | Seed idempotente |
| `npm run gcv -- "tipo: mensaje"` | Commit + versión |

## Estructura

```text
src/app/            rutas (admin, mi, auth, api, legal)
src/components/     ui, base, layout, shared, admin/<módulo>, mi
src/lib/            auth, crud, settings, billing, menus, panel, mi, db…
prisma/             schema, migraciones, seeders
docs/               BRIEF y guías para agentes
```

## Solución de problemas

**Windows: `EPERM: operation not permitted, rename … .nextdevserver*.js.tmp` y el servidor se cae.**
Turbopack escribe sus manifiestos en un archivo temporal y lo renombra; si otro proceso tiene abierto el archivo destino, Windows rechaza el rename. Causas habituales, en orden:

1. **Extensiones que se inyectan en Node** (p. ej. *Console Ninja*): desactívala para este proyecto (Extensiones → *Disable (Workspace)*) y reinicia el servidor.
2. **Antivirus** (Windows Defender en tiempo real): excluye `.next` y `node_modules` desde PowerShell **como administrador**:
   `Add-MpPreference -ExclusionPath "<ruta del proyecto>.next","<ruta del proyecto>
ode_modules"`
3. **Dos procesos usando `.next`** (un `next dev` y un `next build`/`next start` a la vez, o dos `next dev`): usa uno solo.
4. Si sigue pasando: `NEXT_DEV_FS_CACHE=off npm run dev` apaga la caché en disco de Turbopack (arranca más lento, escribe menos).

Para arrancar desde cero tras un bloqueo: `npm run dev:clean` (borra `.next` y arranca).
