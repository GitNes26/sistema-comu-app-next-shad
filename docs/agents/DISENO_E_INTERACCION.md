# Diseño, interacción, animación y safe areas

## Dirección visual

**Cálido, claro y familiar.** COMU-APP es una herramienta de trabajo para pastores, secretaría y servidores, y a la vez el espacio personal de cada creyente. Prioriza lectura, certeza y calidez; la marca se expresa con tema, tipografía y microinteracción, no con ruido ni cards anidadas.

- Superficies por tokens configurables de apariencia (`AppSettings`): matiz primario/acento, tema, fuente, escala, densidad, radio.
- Valores por defecto: primario **azul comunidad** (hue 245, el del sitio de la iglesia), acento **dorado cálido** (hue 85), fuente Poppins. Cada iglesia los cambia en Ajustes → Apariencia; las que ya tenían valores los conservan.
- Cards en reposo: `ring-1 ring-foreground/10`; sombra solo en hover con puntero fino u overlay.
- `primary` para selección/acción; `success`, `warning`, `info`, `destructive` para significado. No hardcodear colores.

## Tipografía

| Uso | Fuente | Token |
|---|---|---|
| Títulos | Montserrat | `font-heading` |
| Subtítulos | Afacad | `font-subheading` |
| Cuerpo | Poppins | `font-sans` (configurable) |
| Cifras, folios, códigos | Space Mono | `font-mono` / `font-mono-price` |

Archivos en `assets/fonts` (cargados en `src/app/layout.tsx`). Las cifras usan `tabular-nums`.

## Marca

Logos en `public/images` (`icon.png` para fondo oscuro, `icon_dark.png` para fondo claro; `logo_*` y las marcas de ministerios: Kids, Babies, Encuentro, Escuela de ministerio, Lanzamiento, etc.). `Logo` elige la versión según el tema; la iglesia puede subir su propio logo.

## Jerarquía de una pantalla

1. Contexto: título corto, descripción útil, acción primaria.
2. Resumen: solo cifras que cambian decisiones.
3. Herramientas: búsqueda, filtros segmentados, vista y exportación.
4. Contenido: tabla, tablero, catálogo o formulario.
5. Feedback: loading, vacío con siguiente acción, error recuperable, confirmación.

En táctil las acciones esenciales son visibles (nada depende de hover).

## Responsive y touch

- Mobile-first. Kids y pase de lista son táctiles también en tablet.
- `desk:` = `(min-width: 48rem) and (pointer: fine)`; `touch:` = puntero grueso. No uses `md:` como «escritorio».
- Objetivos de 44–48 px; separa controles destructivos. Tablas → cards mediante `DataTable`.
- Usa `h-dvh`/`min-h-dvh`, no `100vh`.

## Ancho: siempre todo el espacio disponible (obligatorio)

En escritorio el contenido ocupa el ancho completo del área de trabajo; no se centra en una columna angosta.

- Prohibido `mx-auto max-w-*` en el contenedor de una página o layout (`/admin`, `/mi`, módulos). El ancho lo dicta el shell.
- Se permiten límites de ancho solo en piezas que lo necesitan para leerse bien: texto corrido de un artículo, un flyer, un formulario de inicio de sesión, un diploma. Nunca en listados, tableros ni tarjetas de página.
- Reparte el espacio con rejillas responsivas (`md:grid-cols-2 xl:grid-cols-3`, `lg:grid-cols-[minmax(0,1fr)_20rem]`) en vez de dejarlo vacío; las listas largas pasan a varias columnas.
- Los campos de fecha+hora (`DateTimePicker`) y los combobox llenan el ancho de su celda.

## Todo elemento interactivo lo parece (obligatorio)

Todo lo que se puede tocar o pulsar — botones, enlaces, filas y tarjetas clicables, pestañas, interruptores, casillas, chips, ítems de menú — debe:

- mostrar `cursor: pointer` al pasar el puntero (`not-allowed` si está deshabilitado);
- dar una **animación minimalista** que lo delate como interactivo: elevación o realce sutil con puntero fino y un leve hundimiento (`scale(.97)`) al presionar, siempre bajo `prefers-reduced-motion: no-preference`.

`globals.css` aplica la base a `a[href]`, `button`, `[role=button|tab|menuitem|option|switch|checkbox|radio]`, `summary`, `label[for]` e inputs de casilla/rango/archivo. Para tarjetas y filas clicables que no sean botón ni enlace usa `.press`; si el elemento es un `div` con `onClick`, conviértelo en `button`/`Link` (accesible y con teclado). No inventes animaciones propias por componente.

## Toda página sin sidebar lleva flecha de regreso (obligatorio)

El espacio personal (`/mi`), la cara pública (`/c/[slug]`), `/legal` y `/auth` no tienen sidebar: sin una flecha la persona queda atrapada. `/mi` la pone el layout (`MiBackButton`, en el encabezado, salvo en `/mi`); las demás páginas usan `BackButton` con un `fallback` (el padre natural). Una página nueva sin sidebar que no la tenga es un defecto.

## Safe areas

- `viewport-fit=cover` en el layout raíz.
- Header fijo: `h-[calc(3.5rem+env(safe-area-inset-top))]` con `pt-[env(safe-area-inset-top)]`.
- Barras inferiores: `env(safe-area-inset-bottom)`; el contenido reserva `calc(altura + inset)`.
- Laterales (apaisado con notch): `env(safe-area-inset-left/right)`.
- No dupliques el inset entre shell e hijo; diálogos y drawers ya lo compensan.

## Overlays

Todo diálogo/sheet/drawer pasa por `DialogContent`/`SheetContent`/`DrawerContent` (cierran con «atrás»). Un overlay propio con Radix incluye `<OverlayBackGuard />`. Un cambio de contexto (iglesia) remonta vistas con `key` y limpia caché en memoria.

## Motion

Tokens en `src/lib/animation-tokens.ts` y utilidades `.press`, `rise-in`, `fade-in`. 60 ms press, 150–250 ms estados, ~300 ms sheets/rutas; easing out-quart/expo; sin rebotes en pantallas operativas. Anima relaciones y estados (avance en la visión, progreso), no decoración. Respeta `prefers-reduced-motion`.

## Superficies

- **Panel**: densidad mayor solo con puntero fino; filtros en URL cuando admiten deep link.
- **Mi espacio** (`/mi`): una columna, tarjetas planas, contenido propio; muestra qué falta y cómo resolverlo.
- **Kids (futuro)**: tablet táctil, objetivos grandes, QR por niño, acciones críticas (entrada/salida) con confirmación.

## Contenido

Español claro, verbos de acción y consecuencias. Respeta el vocabulario: creyente, ministerio, servidor, célula/hogar de amor, red, reunión/servicio, etapa de la visión, puesto (≠ rol). Empty state: qué falta + cómo resolverlo. Error: qué pasó + siguiente acción.

## Voz y esencia de casa

La interfaz habla como una familia, no como un sistema: **«¡Bienvenido a casa!»**, «Tu semana en casa», «Soy nuevo», «Quiero integrarme», «Necesito oración». Reglas:

- Botones del portal y de la cara pública en **primera persona** («Quiero servir», no «Solicitar servicio»).
- Lema de la iglesia (`CompanyProfile.tagline`) visible en login, cara pública y pie; por defecto «Familia es lo que somos, comunidad es lo que hacemos».
- Fotografía y logo son protagonistas: la cara pública abre con la foto de bienvenida (`heroImageUrl`) sobre una superficie oscura «santuario» y el logo circular de la iglesia.
- Vacíos y confirmaciones cálidos y concretos («Estamos orando por ti»), nunca técnicos.
- La semana de la iglesia (Dom · Mar · Mié · Vie · Sáb) es el ritmo del portal: `WeekRhythm`.
