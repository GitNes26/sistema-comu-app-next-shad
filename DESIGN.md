# DESIGN — COMU-APP

Sistema de diseño documentado desde el código (ver también `docs/agents/DISENO_E_INTERACCION.md`).

## Tokens

Definidos en `src/app/globals.css` (`@theme inline`) y generados por iglesia desde `AppSettings` (`src/lib/appearance*.ts`).

| Token | Valor por defecto | Notas |
|---|---|---|
| `--primary-hue` | 24 | ámbar-terracota; configurable (0–360) |
| `--accent-hue` | 190 | cian; configurable |
| `--font-family` | Poppins | Poppins / Montserrat / Afacad / sistema |
| `--font-heading` | Montserrat | títulos |
| `--font-subheading` | Afacad | subtítulos |
| `--font-mono-price` | Space Mono | cifras, folios, códigos |
| `--radius-base` | 0.75 | escalado por tema |
| densidad | cómoda | compacta / cómoda / espaciosa |
| tono de superficie | sutil | neutro / sutil / teñido |
| tema | sistema | claro / oscuro / sistema |

Significado: `success`, `warning`, `info`, `destructive` (+ `*-ink` para texto). Nunca colores crudos en componentes.

## Estructura

- Shell: sidebar (escritorio), drawer (tablet), `BottomTabBar` y header sticky (móvil). Mi espacio usa un marco ligero (`src/app/mi/layout.tsx`).
- Cards planas con `ring-1 ring-foreground/10`; sombra solo en hover con puntero fino u overlays.
- Variantes `desk:` (≥48rem y puntero fino) y `touch:`.

## Marca

Logos e íconos en `public/images` y `public/icons` (versiones clara y oscura). Marcas de ministerio: Kids, Babies, Encuentro con Jesús, Escuela de ministerio, Lanzamiento, Intercesión, Mesa de amor, Primicias, Talleres.

## Movimiento

Tokens en `src/lib/animation-tokens.ts`; `.press`, `rise-in`, `fade-in`. 60 ms press, 150–250 ms estados, ~300 ms rutas/sheets. `prefers-reduced-motion` reduce a fundido/instantáneo.

## Componentes canónicos

`DataTable`, `InputGroupField`, `FormCombobox`/`OptionSelect`, `DatePicker`/`TimePicker`, `Attachment`, `SwitchField`, `SegmentedFilter`, `StatusPill`, `EntityCell`, `RowActions`, `ClearFiltersButton`, `DialogComponent`, `PageHeader`, `EmptyState`.
