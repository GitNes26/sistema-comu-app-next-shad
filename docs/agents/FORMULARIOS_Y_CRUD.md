# Formularios, CRUD y componentes canónicos

## Árbol de decisión

1. ¿Es un catálogo CRUD estándar? Usa `src/lib/crud/modules.ts`, `CrudPage`, `CrudForm` y `/api/crud/[module]`. Hoy: creyentes, sedes, puestos y empleados.
2. ¿Es un flujo multi-paso o transaccional? Cliente de dominio con `WizardSteps` si hay etapas reales.
3. ¿Existe componente base? Reúsalo desde `@/components/base`.
4. Crea una abstracción nueva solo si habrá más de un consumidor o encapsula accesibilidad/regla difícil.

## Módulo CRUD

- **Servidor** (`src/lib/crud/modules/<entidad>.ts`): `list/get/create/update/remove` con `organizationId`; valida relaciones (sede, puesto, discípulo) contra la misma iglesia; `remove` inactiva. `parse()` normaliza y rechaza valores fuera de enum.
- **Cliente** (`src/components/admin/crud/crud-config.ts`): columnas, campos (`type`, `icon`, `required`, `yup`, `showIf`, `optionsModule`) y `filters` declarativos (selects que viajan como query al servidor).
- Acciones de fila: editar, eliminar (si `canDelete`) y restaurar los inactivos. La restauración está acotada por iglesia en `/api/crud/[module]/[id]?action=restore`.

## Contrato de formulario

- React Hook Form + Yup; esquema generado por `buildYupSchema` o propio.
- Validación inline con `aria-invalid`, texto de error e icono; `useFocusInvalid().focusFirstInvalid(errors, formId)` enfoca el primer campo inválido (marca el contenedor con `data-form-field`).
- `defaultValues` completos para evitar controlados/incontrolados.
- Normaliza teléfono, correo, claves, fechas y decimales antes de enviar; el servidor vuelve a validar.
- El botón principal muestra progreso, impide doble envío y vive en el footer fijo del diálogo.
- Si una entidad compuesta tiene subformularios, el guardado principal los coordina o avisa con claridad; no dependas de botones secundarios invisibles.

## Campos

| Necesidad | Componente |
|---|---|
| Texto, número, correo, teléfono, contraseña | `InputGroupField` |
| Texto largo | `TextareaField` (etiqueta con icono, pista y error; nunca `Label` + `Textarea` sueltos) |
| Opción fija | `FormCombobox`, sin crear/sincronizar |
| Catálogo relacionado | `OptionSelect` o `FormCombobox` con crear/sincronizar + `CrudCreateDialog` |
| Booleano | `SwitchField`; si es composición manual, `id` + `<label htmlFor>` |
| Fecha / hora | `DatePicker`, `TimePicker`, `DateTimePicker` |
| Archivo/imagen | `Attachment`, nunca URL escrita por el usuario |
| Dirección/ubicación | `AddressField`, `GpsPicker` |
| Cantidad incremental | `QuantityStepper` |

No uses `<select>` ni `<input type="date|time|datetime-local">`. Los campos de búsqueda usan `type="search"`. Labels vinculados por `id`/`htmlFor`; el helper explica para qué y cuándo usar el dato, no repite el label.

## Cada campo lleva un icono acorde con su dato (obligatorio)

El icono comunica de un vistazo qué se captura: dinero → moneda, correo → sobre, teléfono → teléfono, fecha → calendario, hora → reloj, dirección → pin, descripción/notas → texto largo, persona → usuario, cantidad → numeral, enlace → cadena.

- `InputGroupField`, `TextareaField` y `FormCombobox` lo **infieren de la etiqueta, del `type` y del `inputMode`** con `inferFieldIcon` (`src/lib/field-icons.ts`). «Sueldo mensual» muestra moneda, «Correo» un sobre, «Horas por jornada» un reloj.
- `CrudForm` usa el `icon` declarado en `crud-config.ts` y, si falta, infiere por etiqueta y luego por tipo.
- Si la inferencia no acierta, pasa el icono explícito: `leftIcon` (input), `icon` (combobox/textarea). No lo omitas ni dejes el genérico «Aa».
- Grupos que no son un input (`SegmentedFilter`, listas de casillas, días de la semana) llevan su título con icono, como una etiqueta (`<Label className="flex items-center gap-1.5"><Icon /> Texto</Label>`).
- Añade palabras nuevas a `RULES` de `field-icons.ts` en vez de resolverlo caso por caso.

## Teclado, fecha y hora (obligatorio en todo campo nuevo)

El teclado móvil debe corresponder al dato. `ui/input.tsx` e `InputGroupField` lo derivan con `src/lib/input-kind.ts`; si el campo no se infiere por nombre/etiqueta, declara `type`/`inputMode` explícitos.

| Dato | `type` / `inputMode` | Teclado |
|---|---|---|
| Texto libre (nombre, notas, dirección) | `text` | normal |
| Teléfono / celular | `tel` | numérico telefónico |
| Cantidades, enteros, montos | `inputMode="numeric"` (enteros) o `"decimal"` | numérico |
| Correo | `email` | con `@` |
| Sitio web / enlace | `url` | con `/` y `.com` |
| Buscador o filtro | `search` | `Esc` limpia el campo |

- Hora siempre con `TimePicker`; fecha con `DatePicker`; fecha+hora con `DateTimePicker`. Convierte con `src/lib/date-input.ts` (`ymdToDate`, `dateToYmd`, `localToDate`, `dateToLocal`).
- **`DateTimePicker` ocupa todo el ancho disponible** (fecha y hora se reparten la fila; en móvil se apilan). No lo envuelvas en contenedores `w-40`/`w-56`.
- Todo selector de fecha trae **«Hoy»** al pie del calendario y todo selector de hora **«Ahora»** (hora actual); `DateTimePicker` los hereda. La letra de `TimePicker` es una talla menor y sus selects son fluidos para no salirse del contenedor.
- `SegmentedFilter` con más opciones que ancho muestra **flechas** a los lados para desplazar con el puntero (en táctil se arrastra).
- Todo selector de fecha trae **«Hoy»** al pie del calendario y todo selector de hora **«Ahora»** (hora actual); `DateTimePicker` los hereda. La letra de `TimePicker` es una talla menor y sus selects son fluidos para no salirse del contenedor.
- `SegmentedFilter` con más opciones que ancho muestra **flechas** a los lados para desplazar con el puntero (en táctil se arrastra).
- Toda pantalla con filtros o búsqueda incluye `ClearFiltersButton`; solo aparece si hay algún filtro distinto del predeterminado.

## Buscadores, filtros y selectores ignoran mayúsculas y acentos (obligatorio)

«jose» debe encontrar «José», «MUNOZ» a «Muñoz» y «adoracion» a «Adoración».

- Cliente: `matchesSearch(texto, consulta)` y `matchesAllWords` (todas las palabras, en cualquier orden) de `src/lib/search.ts`. **Nunca** `x.toLowerCase().includes(q)`.
- `FormCombobox` y `ui/command.tsx` ya filtran así; un `cmdk` propio pasa `filter={commandFilter}`.
- Servidor: la intercalación `utf8mb4_unicode_ci` de MySQL ya es insensible; usa `contains` de Prisma sin `mode`. No normalices en SQL.
- Un `.toLowerCase().includes()` nuevo en un buscador es un defecto de revisión.

## Avisos

- `notify` (`@/lib/notify`, notistack): guardado, error leve, información, éxito.
- `swalConfirm` / `swalError` (`@/lib/swal`): confirmar acciones destructivas o irreversibles, errores críticos o bloqueos. Nunca como formulario complejo.

## Anatomía de un modal (obligatoria)

`DialogComponent` se compone de **tres partes**, y siempre que haya formulario o detalle se usa así:

1. **Encabezado fijo** — icono en recuadro tintado + **nombre** (`title`) + **leyenda** (`description`) que dice para qué sirve o qué cambia. Si omites `icon`, se infiere del título con `inferDialogIcon` («Nuevo…» → +, «Editar…» → lápiz, «Pagar…» → tarjeta). Pasa `icon` cuando el tema tenga uno propio.
2. **Cuerpo con scroll** — crece en alto según el contenido y, como máximo, hasta casi el 100 % del alto de pantalla (`max-h-[calc(100dvh-2rem)]`, `92dvh` en teléfono). Solo el cuerpo se desplaza; encabezado y pie no.
3. **Pie fijo** — botones de acción final (`footer`): secundario a la izquierda («Cancelar»/«Cerrar»), principal a la derecha, con progreso y `disabled` mientras guarda.

Además: bottom sheet en teléfono, safe areas resueltas, cierre con «atrás» (`OverlayBackGuard`), prevención de cierre accidental por SweetAlert u overlays anidados, y Enter envía cuando es seguro. `size` solo ajusta el ancho (`sm`…`4xl`, `full`). Cada formulario usa un `formId` único (`useId`). No armes modales ad hoc con `Dialog` + estilos propios.

Usa `BottomSheet` solo para interacción nativa con snap points/arrastre. SweetAlert para confirmaciones breves, no para formularios.

## Combobox y creación anidada

- `FormCombobox` siempre puede buscar; `clearable` depende de nulabilidad.
- Opciones de catálogo ofrecen sincronizar y, si el permiso lo permite, crear; `OptionSelect` abre `CrudCreateDialog`, recarga y selecciona el registro creado.
- No conviertas enums fijos en tablas solo para alimentar un selector.

## Tablas y acciones

`DataTable` (orden, paginación, cards móviles, `onRefresh`), `EntityCell`, `StatusPill`, `RowActions`. Fechas DD/MM/YYYY, cifras con `tabular-nums`. Una acción destructiva nombra el objetivo y sus consecuencias; preferir inactivar.

## Accesibilidad

Orden de tab lógico, foco visible, nombre accesible en iconos-botón, color nunca como único canal, objetivos táctiles de 44–48 px (`desk:` compacta solo con puntero fino). Los listeners globales ignoran `input`, `textarea`, `select` y `contenteditable`.
