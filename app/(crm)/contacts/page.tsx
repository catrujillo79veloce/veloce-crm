import { Suspense } from "react"
import { getContacts } from "@/app/actions/contacts"
import { ContactsTable } from "@/components/contacts/ContactsTable"
import { LoadingSpinner } from "@/components/ui"
import type { ContactSource, ContactStatus } from "@/lib/types"

interface ContactsPageProps {
  searchParams: {
    page?: string
    search?: string
    source?: string
    status?: string
    tag?: string
    assignedTo?: string
  }
}

export const metadata = {
  title: "Contactos | Veloce CRM",
}

export default async function ContactsPage({
  searchParams,
}: ContactsPageProps) {
  const page = Number(searchParams.page) || 1
  const pageSize = 25

  const { data, count } = await getContacts({
    page,
    pageSize,
    search: searchParams.search || "",
    source: (searchParams.source as ContactSource) || "",
    status: (searchParams.status as ContactStatus) || "",
    tag: searchParams.tag || "",
    assignedTo: searchParams.assignedTo || "",
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Contactos</h1>
        <p className="text-sm text-gray-500">
          Gestiona todos tus contactos y clientes
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <ContactsTable
          data={data}
          totalRows={count}
          page={page}
          pageSize={pageSize}
        />
      </Suspense>
    </div>
  )
}
