"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Bookmark,
  Wrench,
  MessageCircle,
  Bot,
  Star,
  Loader2,
  DollarSign,
} from "lucide-react"
import DateRangeSelector, {
  type DateRange,
} from "@/components/analytics/DateRangeSelector"
import {
  getOperationsReport,
  type OperationsReport,
} from "@/app/actions/operations-report"

function fmtCop(n: number): string {
  return "$" + n.toLocaleString("es-CO")
}

export default function OperacionAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  })
  const [data, setData] = useState<OperationsReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getOperationsReport(dateRange.from, dateRange.to)
      .then(setData)
      .finally(() => setLoading(false))
  }, [dateRange])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-veloce-600 mb-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Reportes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Operación</h1>
          <p className="text-sm text-gray-500">
            Agenda, reservas, taller y mensajería en el periodo
          </p>
        </div>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-veloce-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Agenda */}
          <Section
            icon={Calendar}
            title="Agenda"
            color="text-blue-600 bg-blue-50"
            metrics={[
              { label: "Citas creadas", value: data.agenda.total },
              { label: "Próximas", value: data.agenda.upcoming, highlight: true },
              { label: "Completadas", value: data.agenda.completed },
              { label: "Canceladas", value: data.agenda.cancelled },
            ]}
          />

          {/* Reservas */}
          <Section
            icon={Bookmark}
            title="Reservas"
            color="text-purple-600 bg-purple-50"
            metrics={[
              { label: "Reservas", value: data.reservas.total },
              { label: "Activas", value: data.reservas.active, highlight: true },
              { label: "Completadas", value: data.reservas.completed },
              {
                label: "Abonos recibidos",
                value: fmtCop(data.reservas.depositsCollected),
                money: true,
              },
              {
                label: "Valor reservado activo",
                value: fmtCop(data.reservas.valueReserved),
                money: true,
              },
            ]}
          />

          {/* Taller */}
          <Section
            icon={Wrench}
            title="Taller"
            color="text-amber-600 bg-amber-50"
            metrics={[
              { label: "Tickets", value: data.taller.total },
              { label: "En proceso", value: data.taller.inProgress, highlight: true },
              { label: "Listas", value: data.taller.ready },
              { label: "Entregadas", value: data.taller.delivered },
              {
                label: "Ingresos taller",
                value: fmtCop(data.taller.revenue),
                money: true,
              },
            ]}
          />

          {/* Mensajería + Bot */}
          <Section
            icon={MessageCircle}
            title="Mensajería y Bot"
            color="text-green-600 bg-green-50"
            metrics={[
              { label: "Mensajes recibidos", value: data.mensajeria.inbound },
              { label: "Mensajes enviados", value: data.mensajeria.outbound },
              {
                label: "Respuestas del bot",
                value: data.mensajeria.aiReplies,
                highlight: true,
              },
              {
                label: "Reseñas solicitadas",
                value: data.mensajeria.reviewRequests,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  color,
  metrics,
}: {
  icon: React.ElementType
  title: string
  color: string
  metrics: { label: string; value: number | string; highlight?: boolean; money?: boolean }[]
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-bold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`bg-white border rounded-xl p-4 ${
              m.highlight ? "border-veloce-300 ring-1 ring-veloce-100" : "border-gray-200"
            }`}
          >
            <p className={`font-bold text-gray-900 ${m.money ? "text-lg" : "text-2xl"}`}>
              {m.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
