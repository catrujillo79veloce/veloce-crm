"use client"

import { Users, Trophy, TrendingUp, Target, CheckSquare } from "lucide-react"
import { Avatar } from "@/components/ui"
import type { TeamMemberPerformance } from "@/app/actions/analytics"

interface TeamPerformanceProps {
  team: TeamMemberPerformance[]
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  sales_rep: "bg-green-100 text-green-700 border-green-200",
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  sales_rep: "Vendedor",
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function TeamPerformance({ team }: TeamPerformanceProps) {
  if (team.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            Performance del equipo
          </h2>
        </div>
        <p className="text-sm text-gray-400 text-center py-6">
          No hay miembros activos en el equipo
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            Performance del equipo
          </h2>
          <span className="text-xs text-gray-400">(este mes)</span>
        </div>
      </div>

      <div className="space-y-3">
        {team.map((m, idx) => (
          <div
            key={m.id}
            className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50/50 transition"
          >
            {/* Header with avatar + name + rank */}
            <div className="flex items-center gap-3 mb-3">
              {idx === 0 && m.won_revenue_mtd > 0 && (
                <Trophy size={18} className="text-amber-500 shrink-0" />
              )}
              <Avatar
                src={m.avatar_url}
                firstName={m.full_name.split(" ")[0]}
                lastName={m.full_name.split(" ").slice(1).join(" ")}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {m.full_name}
                  </p>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      ROLE_COLORS[m.role] ?? ROLE_COLORS.sales_rep
                    }`}
                  >
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">{m.email}</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-green-50 rounded p-2">
                <div className="flex items-center gap-1 text-green-700 mb-0.5">
                  <TrendingUp size={10} />
                  <span className="font-medium">Ingresos</span>
                </div>
                <p className="font-bold text-green-900">
                  {formatMoney(m.won_revenue_mtd)}
                </p>
                <p className="text-[10px] text-green-600">
                  {m.won_deals_mtd} ventas
                </p>
              </div>

              <div className="bg-blue-50 rounded p-2">
                <div className="flex items-center gap-1 text-blue-700 mb-0.5">
                  <Target size={10} />
                  <span className="font-medium">Pipeline</span>
                </div>
                <p className="font-bold text-blue-900">
                  {formatMoney(m.open_pipeline_value)}
                </p>
                <p className="text-[10px] text-blue-600">
                  {m.open_deals} deals
                </p>
              </div>

              <div className="bg-purple-50 rounded p-2">
                <div className="flex items-center gap-1 text-purple-700 mb-0.5">
                  <Users size={10} />
                  <span className="font-medium">Leads</span>
                </div>
                <p className="font-bold text-purple-900">{m.active_leads}</p>
                <p className="text-[10px] text-purple-600">
                  {m.conversion_rate.toFixed(0)}% conv.
                </p>
              </div>

              <div className="bg-amber-50 rounded p-2">
                <div className="flex items-center gap-1 text-amber-700 mb-0.5">
                  <CheckSquare size={10} />
                  <span className="font-medium">Tareas</span>
                </div>
                <p className="font-bold text-amber-900">{m.pending_tasks}</p>
                <p className="text-[10px] text-amber-600">pendientes</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
