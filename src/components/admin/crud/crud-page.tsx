"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ClearFiltersButton } from "@/components/base/clear-filters-button"
import { Input } from "@/components/ui/input"
import { DialogComponent } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/layout/page-header"
import { DataTable } from "@/components/base/data-table"
import { EntityCell, RowActions, SegmentedFilter, StatusPill } from "@/components/base"
import { crudApi } from "@/lib/api"
import { notify } from "@/lib/notify"
import { swalConfirm, swalError } from "@/lib/swal"
import { CrudForm } from "./crud-form"
import { getCrudUi, type CrudColumn, type CrudUiConfig } from "./crud-config"

interface CrudPageProps {
  moduleKey: string
  canManage: boolean
  canDelete: boolean
  icon?: React.ReactNode
}

type Row = Record<string, unknown>

/** Formatea el valor de una celda según el tipo de columna. */
function renderCell(column: CrudColumn, row: Row) {
  const value = row[column.key]
  const type = column.type ?? "text"
  if (value === undefined || value === null || value === "")
    return <span className="text-muted-foreground">—</span>

  switch (type) {
    case "boolean":
      return value ? (
        <StatusPill tone="success" dot={false}>Sí</StatusPill>
      ) : (
        <StatusPill tone="neutral" dot={false}>No</StatusPill>
      )
    case "money":
      return (
        <span className="tabular-nums">
          {Number(value).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
        </span>
      )
    case "percent":
      return <span className="tabular-nums">{(Number(value) * 100).toFixed(2)}%</span>
    case "count":
      return <span className="tabular-nums text-muted-foreground">{Number(value)}</span>
    case "points":
      return (
        <span className="font-medium tabular-nums">
          {Math.floor(Number(value)).toLocaleString("es-MX")}
          <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
        </span>
      )
    case "code":
      return <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{String(value)}</code>
    case "badge": {
      const label = column.displayMap?.[String(value)] ?? String(value)
      const tone = column.tones?.[String(value)]
      return (
        <StatusPill tone={tone ?? "neutral"} dot={Boolean(tone)}>
          {label}
        </StatusPill>
      )
    }
    case "datetime":
      return (
        <span className="tabular-nums text-muted-foreground">
          {new Date(String(value)).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      )
    case "text":
    default:
      return (
        <span className="block max-w-72 truncate">
          {column.displayMap?.[String(value)] ?? String(value)}
        </span>
      )
  }
}

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function CrudPage({ moduleKey, canManage, canDelete, icon }: CrudPageProps) {
  const router = useRouter()
  const config = useMemo<CrudUiConfig | null>(() => getCrudUi(moduleKey) ?? null, [moduleKey])
  const meta = config ?? { module: moduleKey, title: "Módulo", description: "" }
  const searchPlaceholder = config?.searchPlaceholder ?? "Buscar…"

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [q, setQ] = useState("")
  const debouncedQ = useDebounce(q)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters]
  )

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      try {
        const res = await crudApi.list(moduleKey, {
          page,
          pageSize,
          q: debouncedQ,
          ...activeFilters,
        })
        if (signal?.aborted) return
        setRows(res.rows)
        setTotal(res.total)
      } catch (err) {
        if (signal?.aborted) return
        swalError("Error al cargar", err instanceof Error ? err.message : undefined)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [moduleKey, page, pageSize, debouncedQ, activeFilters]
  )

  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, activeFilters])

  const isDebouncing = q !== debouncedQ

  const toggleActive = useCallback(
    async (row: Row, checked: boolean) => {
      if (!canManage) return
      const id = String(row.id)
      setRows((current) =>
        current.map((item) => (String(item.id) === id ? { ...item, isActive: checked } : item))
      )
      try {
        await crudApi.update(moduleKey, id, { isActive: checked })
      } catch (error) {
        setRows((current) =>
          current.map((item) => (String(item.id) === id ? { ...item, isActive: row.isActive } : item))
        )
        swalError("No se pudo cambiar el estado", error instanceof Error ? error.message : undefined)
      }
    },
    [canManage, moduleKey]
  )

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (row: Row) => {
    setEditing(row)
    setDialogOpen(true)
  }

  const handleDelete = async (row: Row) => {
    const name = String(row.name ?? row.fullName ?? "este registro")
    const ok = await swalConfirm(
      `¿Eliminar «${name}»?`,
      "Se inactiva y deja de aparecer en las listas; su historial se conserva.",
      { confirmText: "Eliminar", danger: true }
    )
    if (!ok) return
    setDeletingId(String(row.id))
    try {
      await crudApi.remove(moduleKey, String(row.id))
      notify.success("Eliminado")
      await load()
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined)
    } finally {
      setDeletingId(null)
    }
  }

  const handleRestore = async (row: Row) => {
    const ok = await swalConfirm("Restaurar", "¿Reactivar este registro? Aparecerá de nuevo en la lista.", {
      confirmText: "Restaurar",
    })
    if (!ok) return
    setRestoringId(String(row.id))
    try {
      await crudApi.restore(moduleKey, String(row.id))
      notify.success("Registro restaurado")
      await load()
    } catch (err) {
      swalError("No se pudo restaurar", err instanceof Error ? err.message : undefined)
    } finally {
      setRestoringId(null)
    }
  }

  const handleSubmit = async (values: Row) => {
    if (editing) {
      await crudApi.update(moduleKey, String(editing.id), values)
      notify.success("Cambios guardados")
    } else {
      await crudApi.create(moduleKey, values)
      notify.success("Registro creado")
    }
    setDialogOpen(false)
    await load()
  }

  const columns = useMemo(() => {
    if (!config) return []
    const subtitleKeys = new Set(config.subtitleKeys ?? [])
    const visible = config.columns.filter((col) => !subtitleKeys.has(col.key))
    return visible.map<ColumnDef<Row, unknown>>((col, index) => ({
      id: col.key,
      header: col.key === "isActive" ? "Activo" : col.label,
      accessorKey: col.key,
      cell: ({ row }) => {
        const r = row.original
        // Primera columna: la entidad (imagen/inicial + nombre + línea de apoyo).
        if (index === 0) {
          const subtitle = (config.subtitleKeys ?? [])
            .map((k) => r[k])
            .filter((v) => v !== undefined && v !== null && v !== "")
            .map(String)
            .join(" · ")
          return (
            <EntityCell
              title={String(r[col.key] ?? "—")}
              subtitle={subtitle || undefined}
              image={typeof r.imageUrl === "string" ? r.imageUrl : null}
              muted={r.isActive === false}
            />
          )
        }
        if (col.key === "isActive") {
          return (
            <div onClick={(event) => event.stopPropagation()}>
              <Switch
                checked={Boolean(r.isActive)}
                disabled={!canManage}
                onCheckedChange={(checked) => void toggleActive(r, checked)}
                aria-label={`${r.isActive ? "Desactivar" : "Activar"} ${String(r.name ?? r.fullName ?? "registro")}`}
              />
            </div>
          )
        }
        return renderCell(col, r)
      },
    }))
  }, [canManage, config, toggleActive])

  const actionColumns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    if (!canManage) return []
    return [
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original
          const id = String(r.id)
          const name = String(r.name ?? r.fullName ?? "registro")
          if (r.isActive === false) {
            return (
              <RowActions
                name={name}
                busy={restoringId === id}
                primary={{
                  label: "Restaurar",
                  icon: RotateCcw,
                  onSelect: () => void handleRestore(r),
                  disabled: restoringId === id,
                }}
              />
            )
          }
          return (
            <RowActions
              name={name}
              busy={deletingId === id}
              primary={{ label: "Editar", icon: Pencil, onSelect: () => openEdit(r) }}
              items={[
                {
                  label: "Abrir",
                  icon: FolderOpen,
                  hidden: !config?.detailPath,
                  onSelect: () => router.push(`${config?.detailPath}${id}`),
                },
                {
                  label: "Eliminar",
                  icon: Trash2,
                  destructive: true,
                  hidden: !canDelete,
                  disabled: deletingId === id,
                  onSelect: () => void handleDelete(r),
                },
              ]}
            />
          )
        },
      },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, canDelete, moduleKey, restoringId, deletingId, config?.detailPath])

  const tableColumns = canManage ? [...columns, ...actionColumns] : columns
  const filtersActive = Boolean(q || Object.keys(activeFilters).length)

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <>
      <PageHeader
        icon={icon}
        title={meta.title}
        description={meta.description}
        actions={
          canManage && (
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {config?.newLabel ?? "Nuevo"}
            </Button>
          )
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          {config?.filters?.map((f) => (
            <SegmentedFilter
              key={f.key}
              ariaLabel={f.label}
              value={filters[f.key] ?? ""}
              onChange={(value) => setFilters((current) => ({ ...current, [f.key]: value }))}
              options={[{ value: "", label: `Toda ${f.label.toLowerCase()}`.replace("Toda etapa", "Todas las etapas").replace("Toda jerarquía", "Todas") }, ...f.options]}
            />
          ))}
          <DataTable
            columns={tableColumns}
            data={rows}
            searchable={false}
            showColumnVisibility={false}
            showPagination={false}
            loading={loading}
            emptyMessage={filtersActive ? "Ningún registro coincide con los filtros" : "Sin resultados"}
            rowKey={(r) => String(r.id)}
            onRowClick={
              config?.detailPath
                ? (r) => router.push(`${config.detailPath}${String(r.id)}`)
                : canManage
                  ? openEdit
                  : undefined
            }
            onRefresh={() => load()}
            refreshing={loading}
            toolbarSlot={
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="relative w-full sm:w-80 sm:flex-none">
                  <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
                  <Input
                    type="search"
                    inputMode="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="pl-9 md:pl-9 desk:pl-9 pr-8 md:pr-8 desk:pr-8"
                  />
                  {(isDebouncing || loading) && (
                    <Loader2 className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <ClearFiltersButton
                  active={filtersActive}
                  onClear={() => {
                    setQ("")
                    setFilters({})
                  }}
                />
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {total} {total === 1 ? "registro" : "registros"}
                </span>
              </div>
            }
          />

          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {from}–{to} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Página anterior"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
                  {page} / {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Página siguiente"
                  disabled={page >= pageCount || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogComponent
        open={dialogOpen}
        onOpenChange={(o) => !o && setDialogOpen(false)}
        title={
          editing
            ? `Editar ${config?.singular ?? "registro"}`
            : (config?.newLabel ?? "Nuevo registro")
        }
        description={editing ? String(editing.name ?? editing.fullName ?? meta.title) : meta.description}
        className="max-w-[90vw]"
        footerClassName="gap-2"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={formSaving}>
              Cancelar
            </Button>
            <Button type="submit" form="crud-form" disabled={formSaving}>
              {formSaving && <Loader2 className="size-4 animate-spin" />}
              {editing ? (formSaving ? "Guardando…" : "Guardar cambios") : formSaving ? "Creando…" : "Crear"}
            </Button>
          </>
        }
      >
        {config ? (
          <CrudForm
            key={editing ? String(editing.id) : "new"}
            config={config}
            initial={editing}
            onSubmit={handleSubmit}
            onSavingChange={setFormSaving}
            afterFields={config.afterFields}
          />
        ) : null}
      </DialogComponent>
    </>
  )
}
