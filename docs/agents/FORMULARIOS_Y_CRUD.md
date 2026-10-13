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
- Validación inline con `aria-invalid`; `useFocusInvalid().focusFirstInvalid(errors, formId)` enfoca el primer campo inválido (marca el contenedor con `data-form-field`).
- `defaultValues` completos para evitar controlados/incontrolados.
- Normaliza teléfono, correo y fechas antes de enviar; el servidor vuelve a validar.
- El botón principal muestra progreso, impide doble envío y vive en el footer fijo del diálogo.

## Campos

| Necesidad | Componente |
|---|---|
| Texto, número, correo, teléfono, contraseña | `InputGroupField` |
| Texto largo | `Textarea` con label/helper/error consistentes |
| Opción fija | `FormCombobox` |
| Catálogo relacionado | `OptionSelect` o `FormCombobox` con crear/sincronizar + `CrudCreateDialog` |
| Booleano | `SwitchField` |
| Fecha / hora | `DatePicker`, `TimePicker`, `DateTimePicker` |
| Archivo/imagen | `Attachment`, nunca URL escrita por el usuario |
| Dirección/ubicación | `AddressField`, `GpsPicker` |

No uses `<select>` ni `<input type="date|time|datetime-local">`. Labels vinculados por `id`/`htmlFor`; el helper explica para qué y cuándo usar el dato.

## Teclado, fecha y hora

El teclado móvil debe corresponder al dato (`src/lib/input-kind.ts`): texto `text`, teléfono `tel`, cantidades `numeric`/`decimal`, correo `email`, sitio `url`, buscador `search` (Esc limpia). Fechas con `src/lib/date-input.ts` (`ymdToDate`, `dateToYmd`). Toda pantalla con filtros o búsqueda incluye `ClearFiltersButton`.

## Avisos

- `notify` (`@/lib/notify`, notistack): guardado, error leve, información, éxito.
- `swalConfirm` / `swalError` (`@/lib/swal`): confirmar acciones destructivas o irreversibles, errores críticos o bloqueos. Nunca como formulario complejo.

## Diálogos y overlays

`DialogComponent` con `open`, `onOpenChange`, `title`, `description`, `footer` y cuerpo: header/footer fijos, body con scroll, bottom sheet en teléfono, safe areas resueltas. Cada formulario usa un `formId` único (`useId`). Los overlays cierran con «atrás» (`OverlayBackGuard`).

## Tablas y acciones

`DataTable` (orden, paginación, cards móviles, `onRefresh`), `EntityCell`, `StatusPill`, `RowActions`. Fechas DD/MM/YYYY, cifras con `tabular-nums`. Una acción destructiva nombra el objetivo y sus consecuencias; preferir inactivar.

## Accesibilidad

Orden de tab lógico, foco visible, nombre accesible en iconos-botón, color nunca como único canal, objetivos táctiles de 44–48 px (`desk:` compacta solo con puntero fino).
