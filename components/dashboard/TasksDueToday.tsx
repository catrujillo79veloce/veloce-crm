"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/config"
import { Badge } from "@/components/ui/Badge"
import { PRIORITIES } from "@/lib/constants"
import { completeTask } from "@/app/actions/tasks"
import type { TaskDueToday } from "@/app/actions/analytics"

interface TasksDueTodayProps {
  tasks: TaskDueToday[]
}

export default function TasksDueToday({ tasks: initialTasks }: TasksDueTodayProps) {
  const { t, locale } = useI18n()
  const [tasks, setTasks] = useState(initialTasks)
  const [completing, setCompleting] = useState<string | null>(null)

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId)
    try {
      const result = await completeTask(taskId)
      if (!result.error) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
    } catch (error) {
      console.error("Error completing task:", error)
    } finally {
      setCompleting(null)
    }
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    const due = new Date(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return due < today
  }

  const formatTime = (dueDate: string | null) => {
    if (!dueDate) return ""
    const d = new Date(dueDate)
    return d.toLocaleTimeString(locale === "es" ? "es-CO" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {t.dashboard.tasksDueToday}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 size={32} className="text-veloce-400 mb-2" />
          <p className="text-sm text-gray-500">
            {locale === "es"
              ? "No hay tareas pendientes"
              : "No pending tasks"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-gray-400" />
          <h2 className="text-base font-semibold text-gray-900">
            {t.dashboard.tasksDueToday}
          </h2>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        <Link
          href="/tasks"
          className="text-xs text-veloce-600 hover:text-veloce-700 font-medium flex items-center gap-1"
        >
          {locale === "es" ? "Ver tareas" : "View tasks"}
          <ArrowRight size={12} />
        </Link>
      </div>
      <div className="space-y-1">
        {tasks.map((task) => {
          const overdue = isOverdue(task.due_date)
          const priorityConfig = PRIORITIES.find(
            (p) => p.value === task.priority
          )

          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0",
                overdue && "bg-red-50/50 -mx-2 px-2 rounded-lg"
              )}
            >
              <button
                onClick={() => handleComplete(task.id)}
                disabled={completing === task.id}
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  completing === task.id
                    ? "border-veloce-400"
                    : "border-gray-300 hover:border-veloce-500"
                )}
                aria-label={locale === "es" ? "Completar tarea" : "Complete task"}
              >
                {completing === task.id ? (
                  <Loader2 size={10} className="animate-spin text-veloce-500" />
                ) : null}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{task.title}</p>
                {task.contact_name && (
                  <p className="text-xs text-gray-500 truncate">
                    {task.contact_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {overdue && (
                  <AlertTriangle size={14} className="text-red-500" />
                )}
                {task.due_date && (
                  <span
                    className={cn(
                      "text-xs",
                      overdue ? "text-red-500 font-medium" : "text-gray-400"
                    )}
                  >
                    {formatTime(task.due_date)}
                  </span>
                )}
                <Badge color={priorityConfig?.color}>
                  {priorityConfig?.label[locale] || task.priority}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
