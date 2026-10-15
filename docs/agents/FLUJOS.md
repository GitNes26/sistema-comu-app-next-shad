# Flujos de la iglesia (de punta a punta)

Cada flujo nombra **quién actúa**, **qué cambia en los datos** y **qué avisa el sistema**. Una pantalla nueva debe encajar en uno de estos flujos o declarar el suyo aquí.

## 1. Llegar y crecer (el camino de la visión)

| Paso | Quién | Qué pasa | Aviso |
|---|---|---|---|
| Conoce la iglesia | Visitante | Entra a `/c/[slug]` y toca «Soy nuevo» | — |
| Deja su tarjeta | Visitante | Se crea `Member` (etapa *Ganar*) y un `ConsolidationCase`; una tarjeta `ConnectionCard` queda en la bandeja | Líderes de Consolidación y `members.manage` |
| Seguimiento | Consolidación | Contactos, asignación y, al final, canalización a la **célula/grupo en casa** más cercano | Quien recibe la asignación |
| Encuentro, Escuela, Lanzamiento | Líder / eventos / escuela | Cada hito marca su check al **finalizar** el evento o el grupo y mueve la etapa | La persona (`growth`) |
| Liderazgo y discipulado | Pastores | Cambia jerarquía y etapa; aparece en el organigrama | — |

Regla: el avance de etapa lo produce un hecho (asistencia verificada, grupo cerrado), no una edición manual suelta.

## 2. Dar (ofrendas, diezmos y campañas)

1. Tesorería abre una **campaña** (ComuniDAR · templo, un evento, un proyecto) con meta y vigencia opcionales; puede pausarla o cerrarla. **No siempre hay una activa.**
2. La persona elige *a qué aportar* (general o una campaña abierta) y da en línea o por transferencia.
3. Transferencia: avisa → tesorería **confirma** → nace el `Income` (con `campaignId`) → la meta avanza. En línea: el webhook confirma solo, idempotente.
4. La persona recibe «¡Gracias!»; nadie ve lo que otro dio. Lo reunido sale de los ingresos ligados a la campaña (una sola fuente de verdad con Finanzas).

Recibo: al confirmar, el donativo recibe folio y la persona puede descargar su **recibo en PDF** desde «Mis avisos»; tesorería lo ve en el historial. Es un comprobante interno (no CFDI).

## 3. Eventos y boletos

Organizador crea el evento y su público → publica → las personas **apartan** boleto (o se les asigna) → eligen asiento si hay plano → pagan (abonos) → **entrada por QR** → al finalizar se aplican los checks del camino. Avisos: boleto asignado/cancelado, abonos, saldo liquidado. El boleto mostrado es el comprobante (evento, fecha, hora, lugar, asiento, titular, folio, importe, QR).

## 4. Escuela (alumno ↔ maestro)

Solicitud o inscripción → aprobación → clases con **pase de lista** → tareas y ejercicios (calificación automática + abiertas por revisar) → calificación publicada (aviso) → cierre del grupo (aprobado/no aprobado) → diploma al finalizar el Lanzamiento. El maestro trabaja desde el **Aula** (siguiente clase, quién necesita atención, por revisar); el alumno, desde su **Campus** (avance, material, boleta).

**Teología (trayecto de 6 años)**: el alumno cursa un año a la vez; cada curso suma **puntos** (asistencia, tareas, pagos) y se aprueba con el mínimo; al cerrar el grupo se emite la **credencial** del año. El avance se ve en «Mi trayecto».

## 5. Kids

Registro del niño con tutores → QR → **entrada** registra salón (aviso al tutor) → mensajes y alertas → **salida** solo con el permiso `kids.authorize_exit` (aviso al tutor). Datos de menores: acceso mínimo y por relación.

## 5b. Hogares de amor (grupos en casa = células)

Un solo módulo (Células). Quien busca: **buscador** por ubicación o colonia → «Quiero unirme» → tarjeta con el hogar elegido + aviso a su líder → el líder da la bienvenida y lo integra (alta con aviso). Una persona pertenece a un solo hogar; cambiar es un traspaso. **Familia** es otra cosa: agrupa parentescos del padrón y no define reuniones.

## 6. Ministerios y servicio

Persona solicita servir → líder acepta (alta con aviso) → reuniones del ministerio (aviso a su equipo) → asistencia. Eventos y reuniones generales piden **servidores** a ministerios; el líder asigna y la persona confirma.

## 7. Nómina

Configurar pago por empleado (solo administración y limpieza/mantenimiento) → crear periodo → capturar → **cerrar** (se congela) → **pagar** (genera el gasto una sola vez; no se reabre) → recibos por impresión o correo.

## 8. Comunicación

Publicaciones (con flyer), transmisiones y avisos en vivo (campana + toast + push). Cada aviso sale de un **tipo** del catálogo `src/lib/notifications/kinds.ts`; no se inventan avisos sueltos.
