# Diseño, interacción, animación y safe areas

## Dirección visual

**Cálido, claro y familiar.** COMU-APP es una herramienta de trabajo para pastores, secretaría y servidores, y a la vez el espacio personal de cada creyente. Prioriza lectura, certeza y calidez; la marca se expresa con tema, tipografía y microinteracción, no con ruido ni cards anidadas.

- Superficies por tokens configurables de apariencia (`AppSettings`): matiz primario/acento, tema, fuente, escala, densidad, radio.
- Valores por defecto: primario ámbar-terracota (hue 24), acento cian (hue 190), fuente Poppins. Cada iglesia los cambia en Ajustes → Apariencia.
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
