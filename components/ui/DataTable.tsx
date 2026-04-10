"use client"

import React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type PaginationState,
} from "@tanstack/react-table"
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "./LoadingSpinner"

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  /** Total row count for server-side pagination */
  totalRows?: number
  /** Current pagination state (pageIndex, pageSize) */
  pagination?: PaginationState
  /** Callback for pagination changes (server-side) */
  onPaginationChange?: OnChangeFn<PaginationState>
  /** External sorting state */
  sorting?: SortingState
  /** Callback for sorting changes */
  onSortingChange?: OnChangeFn<SortingState>
  loading?: boolean
  /** Row click handler */
  onRowClick?: (row: TData) => void
  className?: string
}

function DataTable<TData>({
  columns,
  data,
  totalRows,
  pagination,
  onPaginationChange,
  sorting: externalSorting,
  onSortingChange,
  loading = false,
  onRowClick,
  className,
}: DataTableProps<TData>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([])

  const sorting = externalSorting ?? internalSorting
  const setSorting = onSortingChange ?? setInternalSorting

  const pageCount = totalRows && pagination
    ? Math.ceil(totalRows / pagination.pageSize)
    : undefined

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(pagination ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    ...(pagination && onPaginationChange
      ? {
          onPaginationChange,
          manualPagination: true,
          pageCount,
        }
      : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: externalSorting ? undefined : getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  const showFrom =
    pagination ? pagination.pageIndex * pagination.pageSize + 1 : 1
  const showTo = pagination
    ? Math.min(
        (pagination.pageIndex + 1) * pagination.pageSize,
        totalRows ?? data.length
      )
    : data.length
  const total = totalRows ?? data.length

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500",
                        canSort && "cursor-pointer select-none"
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {canSort && (
                          <span className="ml-1 text-gray-400">
                            {sorted === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center"
                >
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="md" />
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-sm text-gray-500"
                >
                  Sin resultados
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-gray-100 transition-colors hover:bg-gray-50",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-500">
            Mostrando {showFrom} a {showTo} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Pagina anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium text-gray-700">
              {(pagination.pageIndex ?? 0) + 1} / {pageCount ?? 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Pagina siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
