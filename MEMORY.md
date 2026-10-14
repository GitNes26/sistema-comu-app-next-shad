# MEMORY — índice rápido

Hechos duraderos para reanudar trabajo. El detalle vive en [`CONTEXTO_SISTEMA.md`](CONTEXTO_SISTEMA.md) y en [`docs/agents/`](docs/agents/README.md).

## Proyecto

- COMU-APP: gestión integral de iglesia, multi-iglesia, monolito Next.js 16 + Prisma 7 + MySQL. Primera iglesia: Comunidad Torreón.
- Carpeta: `COMU-APP/sistema-comu-app`. Recursos de marca originales en `COMU-APP/OTROS` (ya copiados a `assets/fonts` y `public`).
- Derivado de la plantilla administrativa de Multi-POS (solo estructura y reglas; sin dominio de punto de venta).

## Decisiones

- Tenant = iglesia (`Organization`); `Location` = sede (opcional); `Member` = creyente, entidad central con o sin usuario.
- Niveles `OrgRole`: superadmin, owner, admin, leader, servant, believer. Roles configurables en `Role` (con `level`).
- Acceso a lo propio por **relación**, no por cambio de rol. Puesto ≠ rol. Una persona acumula papeles (líder de varios ministerios, encargado de red, discípulo…).
- Salida de Kids: personal con permiso `kids.authorize_exit`. Transmisiones incrustadas. Donativos: preparar pago en línea. Venta a otras iglesias: futura, estructura lista.
- Creyente (`scope: portal`) → `/mi`; el resto → `/admin`.
- Avisos con notistack; SweetAlert2 solo alto impacto. `proxy.ts` reemplaza `middleware.ts` (Next 16).
- Excepciones de versión: TypeScript 6 (typescript-eslint), TanStack Table 8, nodemailer 7 (peer de next-auth 4).
- Colores por defecto (hue 24 / 190) y tono «cálido, claro, familiar» son supuestos; cada iglesia los ajusta en Apariencia.

## Estado (v0.17.0)

- Hecho: núcleo, plataforma, ajustes, creyentes, sedes, puestos, empleados, panel, Mi espacio y **ministerios** (papel por ministerio, reuniones, lista, requisiciones).
- Alabanza, Consolidación y Kids hechos (permiso `kids.authorize_exit`; rol «Personal de Kids»). Células y redes hechas (avance en la visión lo actualiza el líder de célula; cumpleañeros del mes con festejo en la última reunión). Reuniones generales hechas (asistencia por categoría, «nuevos» no suma). Grupos (Jóvenes/Varones/Mujeres = ministerios dueños de reuniones, células y eventos) y Eventos con boletaje/acomodo hechos. Escuela ministerial y portal educativo hechos (planilla como la hoja, 7 tipos de pregunta); gastos de evento ligados a Finanzas (`Expense`). Libro digital con apuntes privados, diploma al Lanzamiento y Finanzas/vehículos/nómina hechos. Diploma al FINALIZAR el Lanzamiento (diseño del sistema o plantilla subida con el nombre en cursiva Dancing Script). Portal del creyente hecho (noticias, transmisiones YouTube/Facebook, perfil, solicitudes para servir, permiso `content.manage`). Checks del camino (bautismo, encuentro, lanzamiento) se marcan al FINALIZAR el evento con asistencia; consolidación con dirección+mapa y canalización a la célula más cercana; Reportes con PDF/CSV hechos. Pagos en línea (Stripe/Mercado Pago por iglesia, credenciales cifradas, webhook firmado e idempotente) y notificaciones push/bandeja del creyente hechos (probados con firmas simuladas; falta probar contra cuentas reales de cada pasarela y con llaves VAPID). Envío programado de reportes por correo hecho (planificador interno + cron externo; probado hasta la entrega SMTP, falta probar con un SMTP real). Reportes con comparativo (periodo anterior / año pasado) y gráficas en pantalla y PDF hechos. Pulido: sin errores de lint, código heredado del POS (ventas, mensajería) eliminado. Conciliación bancaria (CSV) hecha: con ella el roadmap numerado queda completo. Pendiente → pruebas con cuentas reales (pasarelas, SMTP, push); lo comercial (alta autoservicio, cobro de suscripción, dominio por iglesia) solo cuando se decida vender; Asistencia de servidores en reuniones generales (`GatheringServer`) y servidores para eventos (pedido del organizador, asigna el líder, ofrecimientos) hechos: el roadmap de ministerios queda completo. (antes: finanzas (CONTEXTO_SISTEMA §7).

## Convenciones de interfaz (v0.18)

- Todo campo con icono según su dato (`src/lib/field-icons.ts`); modal = encabezado (icono + nombre + leyenda) + cuerpo con scroll + pie; texto largo con `TextareaField`.
- Páginas a ancho completo (sin `mx-auto max-w-*`); `DateTimePicker` llena su celda.
- Todo elemento accionable: `cursor: pointer` + animación mínima (base en `globals.css`).
- Buscadores/filtros/selectores sin distinción de mayúsculas ni acentos (`src/lib/search.ts`).
- Nómina propia en `/admin/payroll` (migración `payroll_module`) y flyers de publicaciones (`post_flyers`): las migraciones nuevas deben aplicarse con `prisma migrate deploy` (en la BD local de desarrollo, `db push` si no tiene historial).

## Entorno

- BD local `db_comu_app` (MySQL). `.env` desde `.env.example`. Demo: `SEED_DEMO=true npm run db:seed` (usuarios `demo.*@comuapp.test`).
- Puerto de desarrollo usado en verificación: 3100 (`NEXTAUTH_URL` debe coincidir).
