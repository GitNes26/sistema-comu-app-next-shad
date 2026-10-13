# Brief del proyecto — COMU-APP (Comunidad Torreón)

Plantilla de `plan-plantilla-administrativa` llenada con el relato del pastor/administrador.
Lo marcado **(supuesto)** no fue dicho explícitamente: se propone y puede corregirse.

```text
Usa la skill plan-plantilla-administrativa en modo Crear.

[1. NOMBRE Y PROPÓSITO]
Nombre del sistema: COMU-APP
Qué resuelve: llevar el control, la administración y la gestión integral de una iglesia
  (administración, ministerios, células, reuniones, eventos, escuela, kids, crecimiento
  personal, contenido y reportes) donde cada creyente es parte del sistema con su acceso.
Carpeta destino: C:\Users\Usuario\Desktop\Otros\NESTOR\NESSIK\COMU-APP\sistema-comu-app
Paquete: sistema-comu-app

[2. DOMINIO Y VOCABULARIO]
organización = iglesia (Comunidad Torreón de La Laguna)   unidad = sede (opcional)
Member/Creyente = creyente (persona del padrón, con o sin usuario)
Puesto = responsabilidad (Directora de Kids, Maestro de apoyo, Anfitrión…)  ≠  Rol = perfil de
  accesos/permisos en el sistema
Ministry = ministerio · Servidor = creyente que sirve en un ministerio
Cell = célula u «Hogar de amor» · Network = red (grupo de células a cargo de un discípulo)
Service = reunión general (servicio) · Event = evento (interno/externo, tabernáculo)
School = Escuela de Ministerio (libros/grados) · Teología = Universidad Teológica
Kids = Comunidad Kids (bebés y niños) · Visión = etapas de crecimiento
Idioma: español   Moneda: MXN   Zona horaria: America/Mexico_City (supuesto)

[3. USUARIOS Y ROLES]
Jerarquía eclesiástica: Pastor > Discípulo > Líder de ministerio/célula > Creyente
Roles del sistema: Superadmin (plataforma) · Administrador de iglesia · Pastor ·
  Administrativo/Tesorero · Líder de red · Líder de célula · Líder de ministerio ·
  Maestro (escuela) · Discípulo · Creyente (base de todo miembro)
Rol «todo en uno»: sí (supuesto: «Administrativo completo» para equipos pequeños)
Usuarios finales externos (portal): sí — todo creyente puede tener usuario; entra a «Mi
  espacio» (crecimiento, ministerios, escuela, hijos en Kids, transmisiones, contenido).
Regla de acceso: el rol base no cambia al servir; los accesos adicionales nacen de la
  RELACIÓN (ser líder de un ministerio, alumno de un libro, padre de un niño).

[4. TENANCY]
Organizaciones: varias (superadmin gestiona iglesias)   Unidad: sede (opcional por iglesia)

[5. MÓDULOS Y ENTIDADES]
Entidades: Creyente, Usuario, Ministerio, Célula/Red, Reunión (servicio), Evento,
  Escuela (libro/inscripción/calificación), Kids (niño/salón/asistencia QR), Finanzas
  (ingreso/gasto), Empleado/Puesto/Nómina, Vehículo, Publicación.
Primer módulo: Creyentes (padrón) + administración base (usuarios, roles, iglesia,
  apariencia). Luego: Ministerios → Células/Redes → Reuniones → Eventos → Escuela → Kids →
  Finanzas/Empleados/Vehículos → Crecimiento personal/Portal → Contenido → Reportes → Panel.
Flujos clave: consolidación (nuevo → seguimiento → célula), pase de lista (ministerio,
  célula, servicio, clase), rol y programa mensual de alabanza, inscripción a libro (uno a
  la vez), check-in/out Kids por QR, evento con cupo y pagos.

[6. PLANES / LICENCIAS]
Se vende por planes: no por ahora (supuesto); se conserva la intersección rol ∩ plan con un
  único plan «Completo» para poder activar módulos por iglesia después.

[7. MARCA Y TONO]
Marca: Comunidad Torreón (logos, íconos y fuentes en COMU-APP\OTROS).
Tipografías: Montserrat (títulos), Afacad (subtítulos), Poppins (cuerpo), Space Mono (cifras).
Tres adjetivos: cálido, claro, familiar (supuesto).
Referencias: estructura de Multi-POS; no copiar su aspecto. Evitar lo solemne/recargado.

[8. DISPOSITIVOS Y ENTORNO]
Dispositivos: móvil (creyentes, servidores), tablet (Kids, lista), escritorio (administración)
PWA: sí   Hosting: por definir (supuesto VPS)   BD: MySQL

[9. CAPACIDADES OPCIONALES]
Adjuntos/evidencias, imágenes, Excel (importar/exportar), PDF de reportes, reportes y
gráficas, QR (gafete Kids), tiempo real SSE (chat/alertas Kids, notificaciones), mapas
(ubicación de células), push, wizards (inscripciones), correo, plataforma educativa
(cuestionarios con 7 tipos de pregunta), YouTube/Facebook como enlace/embed.

[10. RESTRICCIONES]
Privacidad de datos personales y de menores; PLAN.md/README.md de COMU-APP solo como
antecedente (el relato y las referencias mandan); cada módulo crece con el tiempo.
```

## Modelo de acceso propuesto (responde a la duda sobre inscripción y permisos)

| Situación | ¿Cambia el rol? | Cómo se resuelve |
|---|---|---|
| Creyente sin servir | No | Rol `Creyente`: su perfil, crecimiento, ministerios, escuela (info y solicitar inscripción), transmisiones, contenido |
| Se inscribe a un libro | No | Aparece su **inscripción**; el menú «Mi escuela» y el contenido de su libro se muestran por esa relación |
| Entra a un ministerio como servidor | No | Ve «Mi ministerio» (cuándo le toca, avisos, roles de servicio) por ser miembro |
| Es líder de ministerio | No (o rol `Líder de ministerio` si administra) | Gestiona **solo** su ministerio (alcance «propio/asignado») |
| Tiene hijos en Kids | No | Ve a sus hijos, QR y chat por la relación padre/tutor |

Regla: *permiso del rol ∩ plan* para acciones administrativas; *relación* (membresía,
inscripción, tutela) para acceso a lo propio. Ambas se validan en servidor.

## Respuestas del cliente (2026-10-12) y decisiones

1. **Venta a otras iglesias**: no en esta versión; la estructura queda lista (multi-iglesia, planes, suscripciones, bloqueo, superadmin).
2. **Sedes**: hoy una; pronto varias (el modelo ya las soporta).
3. **Diezmos y ofrendas**: hoy a mano y por transferencia; debe quedar preparado el pago en línea de donativos.
4. **Control vehicular**: bitácora, mantenimiento, combustible, seguro y verificación (todo).
5. **Nómina**: simple por ahora.
6. **Alabanza**: catálogo de canciones (tono, letra, enlaces de referencia e imagen) para armar el programa semanal.
7. **YouTube/Facebook**: transmisión **incrustada** (sin API).
8. **Escuela**: costos de inscripción y libro, calificación mínima y escala: todo configurable.
9. **Kids**: la salida la autoriza personal con el permiso «autorizar salida» (perfiles/roles), no solo quien muestra el QR.
10. **Correo, dominio y hosting**: por definir.

**Modelo de «transformación» del creyente**: todos son creyentes; con el avance en la visión pueden ser líderes, discípulos, líderes de varios ministerios y encargados de una red a la vez. Se resuelve con **relaciones** (no con cambiar el rol): una persona puede tener varios papeles simultáneos, cada uno con su alcance.


## Aclaraciones posteriores (v0.7.0)

- **Jóvenes** funciona como una iglesia aparte dentro de la congregación: ministerio con pastores, líderes, servidores y creyentes; con reuniones propias (tema, quién comparte, asistencia, ministerios en servicio, consolidación), células (todas las de jóvenes son una red), eventos y requisiciones. **Varones** y **Mujeres** son grupos análogos con reuniones eventuales. Modelado: grupo = ministerio `youth`/`group` cuyos pastores y líderes gestionan sus reuniones, células y eventos.
- **Eventos internos**: además de su configuración llevan organización/itinerario y **control de boletos** para asistencia y acomodo; el acomodo es opcional (libre, por secciones, por asientos/mesas), con plano 2D/3D editable por área, y la elección del lugar puede ser de cada persona, del personal o ambas. Áreas actuales: Auditorio Principal, Auditorio Menor y Área de Comunidad Kids. **Eventos externos**: configuración normal (cuota, cupo, lugar).
- **Gastos de eventos**: se capturan por evento y también se ven en Finanzas; son el mismo registro (ligado al evento).
- **Escuela**: es un portal educativo completo (escuela virtual): salones virtuales con libro digital configurable, pase de lista, clase, calificaciones y cuestionarios de tareas y ejercicios con 7 tipos de pregunta. Formato de la hoja de la escuela: asistencias, tareas 1–7 con promedio, ejercicios 1–7 con promedio y general.
- **Libro digital**: se suben PDF, Word o imágenes; se secciona por clase; el alumno subraya de colores, escribe sobre el archivo y deja notas poco invasivas; cada quien conserva sus propios apuntes.
- **Diploma y crecimiento**: al aprobar cada libro se actualiza el crecimiento espiritual; el diploma llega al hacer el segundo encuentro con Jesús, el evento «Lanzamiento».
- **Diploma**: se entrega al finalizar el Lanzamiento; la escuela puede usar el diseño del sistema o subir su imagen/PDF y el sistema escribe el nombre del alumno en una cursiva legible.
- **Portal del creyente**: noticias y devocionales, transmisiones en vivo incrustadas (YouTube/Facebook), su agenda, su perfil y poder pedir servir en un ministerio.
- **Crecimiento**: el bautismo en aguas, el Encuentro con Jesús y el Lanzamiento son eventos siempre con la misma estructura; al finalizarlos y verificar la asistencia se marcan como checks en el crecimiento. El orden es el recomendado, no obligatorio.
- **Dirección y cercanía**: quien llega a Consolidación se registra con dirección y mapa; el sistema sugiere la célula más cercana según el tipo (mujeres, matrimonios, jóvenes…) para canalizarlo con su líder.
- **Reportes**: se consultan por periodo y se exportan a PDF.
- **Pagos en línea**: cada iglesia conecta su propia pasarela (tarjeta); el cobro solo se registra cuando la pasarela lo confirma.
- **Notificaciones**: anuncios, transmisiones en vivo, pagos, diplomas y asignaciones llegan a la bandeja y como notificación push.
- **Reportes por correo**: se pueden programar para que lleguen solos cada semana o cada mes, en PDF, a quien la iglesia decida.
- **Comparativos**: cada reporte se puede comparar con el periodo anterior o con el mismo periodo del año pasado, con gráficas.
- **Conciliación bancaria**: se importa el estado de cuenta del banco y cada movimiento se cota con los ingresos y gastos registrados.
- **Servicio en reuniones**: cada ministerio en servicio pasa lista de sus servidores en las reuniones generales; hay un reporte de asistencia y faltas.
- **Servidores para eventos**: el organizador pide servidores a ministerios (p. ej. 5 ujieres); cada líder asigna a quién y los servidores confirman o se ofrecen.
