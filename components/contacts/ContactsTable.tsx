"use client"

import React, { useCallback, useMemo, useTransition } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Plus, Search } from "lucide-react"
import {
  DataTable,
  Button,
  Input,
  Select,
  Avatar,
  Badge,
} from "@/components/ui"
import { ChannelBadge } from "./ChannelBadge"
import { useI18n } from "@/lib/i18n/config"
import { formatRelativeTime } from "@/lib/utils"
import { CONTACT_SOURCES } from "@/lib/constants"
import type { Contact, ContactSource } from "@/lib/types"

// -------------------------------------------------------------------
// Props
// -------------------------------------------------------------------

interface ContactsTableProps {
  data: Contact[]
  totalRows: number
  page: number
  pageSize: number
}

// -------------------------------------------------------------------
// Status options
// -------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "do_not_contact", label: "No Contactar" },
]

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function ContactsTable({
  data,
  totalRows,
  page,
  pageSize,
}: ContactsTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t, locale } = useI18n()
  const [isPending, startTransition] = useTransition()

  // --- URL helpers ---------------------------------------------------

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      })
      // Reset to page 1 when filters change (except when changing page itself)
      if (!("page" in updates)) {
        params.delete("page")
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router]
  )

  // --- Current filter values from URL --------------------------------

  const currentSearch = searchParams.get("search") ?? ""
  const currentSource = searchParams.get("source") ?? ""
  const currentStatus = searchParams.get("status") ?? ""

  // --- Column definitions -------------------------------------------

  const columns = useMemo<ColumnDef<Contact, any>[]>(
    () => [
      {
        id: "name",
        header: t.contacts.firstName,
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        cell: ({ row }) => {
          const c = row.original
          return (
            <div className="flex items-center gap-3">
              <Avatar
                src={c.avatar_url}
                firstName={c.first_name}
                lastName={c.last_name}
                size="sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {c.first_name} {c.last_name}
                </p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "email",
        header: t.contacts.email,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600 truncate block max-w-[200px]">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "phone",
        header: t.contacts.phone,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-600">
            {(getValue() as string) || "-"}
          </span>
        ),
      },
      {
        accessorKey: "source",
        header: t.contacts.source,
        cell: ({ getValue }) => (
          <ChannelBadge source={getValue() as ContactSource} />
        ),
      },
      {
        id: "tags",
        header: t.contacts.tags,
        cell: ({ row }) => {
          const tags = row.original.tags ?? []
          if (tags.length === 0) return <span className="text-gray-400">-</span>
          return (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} color={tag.color} className="text-[10px]">
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: "assigned",
        header: t.contacts.assignedTo,
        cell: ({ row }) => {
          const m = row.original.assigned_member
          if (!m) return <span className="text-gray-400">-</span>
          return (
            <div className="flex items-center gap-2">
              <Avatar
                src={m.avatar_url}
                firstName={m.full_name.split(" ")[0]}
                lastName={m.full_name.split(" ")[1]}
                size="sm"
              />
              <span className="text-sm text-gray-700 truncate max-w-[120px]">
                {m.full_name}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: "created_at",
        header: t.contacts.createdAt,
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500">
            {formatRelativeTime(getValue() as string, locale)}
          </span>
        ),
      },
    ],
    [t, locale]
  )

  // --- Source options for dropdown ------------------------------------

  const sourceOptions = useMemo(
    () =>
      CONTACT_SOURCES.map((s) => ({
        value: s.value,
        label: s.label[locale] ?? s.label.es,
      })),
    [locale]
  )

  // --- Pagination state for DataTable --------------------------------

  const pagination = useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  )

  const handlePaginationChange = useCallback(
    (updater: any) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater
      updateParams({ page: String(next.pageIndex + 1) })
    },
    [pagination, updateParams]
  )

  // --- Row click -----------------------------------------------------

  const handleRowClick = useCallback(
    (row: Contact) => {
      router.push(`/contacts/${row.id}`)
    },
    [router]
  )

  // --- Render --------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder={t.contacts.search}
              icon={<Search className="h-4 w-4" />}
              defaultValue={currentSearch}
              onChange={(e) => {
                const value = e.target.value
                // Debounce-like: update on blur or after typing
                clearTimeout((window as any).__contactSearchTimer)
                ;(window as any).__contactSearchTimer = setTimeout(() => {
                  updateParams({ search: value })
                }, 400)
              }}
            />
          </div>
          <div className="flex gap-2">
            <Select
              options={sourceOptions}
              placeholder={t.contacts.source}
              value={currentSource}
              onChange={(e) => updateParams({ source: e.target.value })}
              className="w-36"
            />
            <Select
              options={STATUS_OPTIONS}
              placeholder={t.contacts.status}
              value={currentStatus}
              onChange={(e) => updateParams({ status: e.target.value })}
              className="w-36"
            />
          </div>
        </div>
        <Button onClick={() => router.push("/contacts/new")}>
          <Plus className="h-4 w-4" />
          {t.contacts.newContact}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={data}
          totalRows={totalRows}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
          loading={isPending}
          onRowClick={handleRowClick}
        />
      </div>
    </div>
  )
}
