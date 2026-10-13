"use client"

import * as React from "react"
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Inbox,
  RefreshCw,
  Search,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/base/spinner"
import { InputGroupField } from "./input-group-field"
import { ClearFiltersButton } from "./clear-filters-button"

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  pageSizeOptions?: number[]
  enableSelection?: boolean
  rowKey?: (row: TData) => string
  onSelectedRowsChange?: (rows: TData[]) => void
  onRowClick?: (row: TData) => void
  loading?: boolean
  emptyMessage?: string
  showPagination?: boolean
  showColumnVisibility?: boolean
  toolbarSlot?: React.ReactNode
  /** Hay filtros externos (en `toolbarSlot`) distintos de su valor por defecto. */
  filtersActive?: boolean
  /** Regresa los filtros externos a su valor por defecto; la búsqueda interna se limpia sola. */
  onClearFilters?: () => void
  onRefresh?: () => void
  refreshing?: boolean
  renderCard?: (row: TData) => React.ReactNode
  className?: string
  tableClassName?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Buscar…",
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  enableSelection = false,
  rowKey,
  onSelectedRowsChange,
  onRowClick,
  loading = false,
  emptyMessage = "Sin resultados",
  showPagination = true,
  showColumnVisibility = true,
  toolbarSlot,
  filtersActive = false,
  onClearFilters,
  onRefresh,
  refreshing = false,
  renderCard,
  className,
  tableClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})

  const selectionColumn = React.useMemo<ColumnDef<TData, TValue>>(
    () => ({
      id: "select",
      size: 28,
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Seleccionar todo"
          className="size-4 rounded-sm accent-primary"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Seleccionar fila"
          className="size-4 rounded-sm accent-primary"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    }),
    []
  )

  const allColumns = React.useMemo(() => {
    if (!enableSelection) return columns
    const hasSelect = columns.some((c) => "id" in c && c.id === "select")
    return hasSelect ? columns : [selectionColumn, ...columns]
  }, [columns, enableSelection, selectionColumn])

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: enableSelection,
    getRowId: rowKey ? (row) => rowKey(row) : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  })

  const selectedRows = React.useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowSelection, data]
  )

  React.useEffect(() => {
    if (onSelectedRowsChange) onSelectedRowsChange(selectedRows)
  }, [selectedRows, onSelectedRowsChange])

  const pageCount = table.getPageCount()

  function renderCards() {
    const visibleRows = table.getRowModel().rows
    if (visibleRows.length === 0) return <RowEmpty message={emptyMessage} />
    return (
      <div className="space-y-2">
        {visibleRows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "rounded-2xl border bg-card p-3.5",
              onRowClick && "cursor-pointer transition-colors active:bg-muted"
            )}
            onClick={() => onRowClick?.(row.original)}
          >
            {renderCard ? renderCard(row.original) : defaultCard(row)}
          </div>
        ))}
      </div>
    )
  }

  // Tarjeta móvil por defecto: la primera columna es el título, el resto se
  // muestra como pares etiqueta/valor y las acciones van en su propia fila.
  function defaultCard(row: Row<TData>) {
    const cells = row.getVisibleCells().filter((c) => c.column.id !== "select")
    const actions = cells.find((c) => c.column.id === "actions")
    const content = cells.filter((c) => c.column.id !== "actions")
    const [first, ...rest] = content
    return (
      <div className="flex flex-col gap-3">
        {first && (
          <div className="min-w-0 text-sm">
            {flexRender(first.column.columnDef.cell, first.getContext())}
          </div>
        )}
        {rest.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {rest.map((cell) => (
              <div key={cell.id} className="min-w-0">
                <dt className="truncate text-xs text-muted-foreground">
                  {headerLabel(cell.column)}
                </dt>
                <dd className="truncate text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {actions && (
          <div className="-mb-1 flex justify-end border-t pt-2" onClick={(e) => e.stopPropagation()}>
            {flexRender(actions.column.columnDef.cell, actions.getContext())}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {(searchable || showColumnVisibility || toolbarSlot || onRefresh) && (
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-11 shrink-0 desk:size-8"
                    onClick={onRefresh}
                    aria-label="Refrescar"
                  >
                    <RefreshCw
                      className={cn("size-4", refreshing && "animate-spin")}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refrescar</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {searchable && (
            <InputGroupField
              type="search"
              placeholder={searchPlaceholder}
              leftIcon={<Search className="size-4" />}
              className="w-full md:max-w-80"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
          )}
          {toolbarSlot}
          <ClearFiltersButton
            active={Boolean(globalFilter) || columnFilters.length > 0 || filtersActive}
            onClear={() => {
              setGlobalFilter("")
              setColumnFilters([])
              onClearFilters?.()
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            {showColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 desk:h-8">
                    <EyeOff className="size-4" />
                    Columnas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(v) => column.toggleVisibility(v)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {String(headerLabel(column))}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      <div className="hidden md:block">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table className={tableClassName}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            header.column.getCanSort() &&
                              "cursor-pointer select-none"
                          )}
                          onClick={
                            header.column.getCanSort()
                              ? header.column.getToggleSortingHandler()
                              : undefined
                          }
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanSort() && (
                            <SortIcon sorted={header.column.getIsSorted()} />
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={allColumns.length}
                    className="h-32 text-center"
                  >
                    <Spinner className="mx-auto size-6" />
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={allColumns.length}
                    className="text-center"
                  >
                    <RowEmpty message={emptyMessage} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="md:hidden">{renderCards()}</div>

      {showPagination && !loading && pageCount > 1 && (
        <PaginationFooter table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  )
}

function headerLabel<TData, TValue = unknown>(
  column: Column<TData, TValue>
): string {
  const h = column.columnDef.header
  if (typeof h === "string") return h
  return column.id
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5 text-primary" />
  if (sorted === "desc") return <ArrowDown className="size-3.5 text-primary" />
  return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />
}

function RowEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function PaginationFooter<TData>({
  table,
  pageSizeOptions,
}: {
  table: ReturnType<typeof useReactTable<TData>>
  pageSizeOptions: number[]
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="hidden sm:inline">Filas por página</span>
        <Select
          value={String(table.getState().pagination.pageSize)}
          onValueChange={(v) => table.setPageSize(Number(v))}
        >
          <SelectTrigger className="h-11 w-16 text-xs desk:h-7" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline">
          {table.getState().pagination.pageIndex *
            table.getState().pagination.pageSize +
            1}
          –
          {Math.min(
            (table.getState().pagination.pageIndex + 1) *
              table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{" "}
          de {table.getFilteredRowModel().rows.length}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-11 desk:size-7"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
          {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 desk:size-7"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
