"use client"

import React, { useState, useCallback, useMemo, useTransition } from "react"
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react"
import { useI18n } from "@/lib/i18n/config"
import { cn, formatRelativeTime } from "@/lib/utils"
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants"
import { completeTask, updateTask } from "@/app/actions/tasks"
import type { Task, TaskStatus } from "@/lib/types"
import { Avatar, Badge, Button } from "@/components/ui"
import { TaskForm } from "./TaskForm"

interface TeamMemberOption {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
}

interface ContactOption {
  id: string
  first_name: string
  last_name: string
  email: string | null
  avatar_url: string | null
}

interface TaskListProps {
  initialTasks: Task[]
  teamMembers: TeamMemberOption[]
  contacts: ContactOption[]
}

type TaskGroup = "overdue" | "today" | "upcoming" | "completed" | "no_date"

function groupTasks(tasks: Task[]): Record<TaskGroup, Task[]> {
  const now = new Date()
  const todayStr = now.toISOString().split("T")[0]

  const groups: Record<TaskGroup, Task[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    no_date: [],
    completed: [],
  }

  for (const task of tasks) {
    if (task.status === "completed") {
      groups.completed.push(task)
      continue
    }

    if (!task.due_date) {
      groups.no_date.push(task)
      continue
    }

    const dueStr = task.due_date.split("T")[0]
    if (dueStr < todayStr) {
      groups.overdue.push(task)
    } else if (dueStr === todayStr) {
      groups.today.push(task)
    } else {
      groups.upcoming.push(task)
    }
  }

  return groups
}

export function TaskList({ initialTasks, teamMembers, contacts }: TaskListProps) {
  const { t, locale } = useI18n()
  const [, startTransition] = useTransition()
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [expandedGroups, setExpandedGroups] = useState<Record<TaskGroup, boolean>>({
    overdue: true,
    today: true,
    upcoming: true,
    no_date: true,
    completed: false,
  })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all")

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks
    return tasks.filter((task) => task.status === statusFilter)
  }, [tasks, statusFilter])

  const grouped = useMemo(() => groupTasks(filteredTasks), [filteredTasks])

  const toggleGroup = useCallback((group: TaskGroup) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }, [])

  const handleComplete = useCallback(
    (taskId: string) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: "completed" as TaskStatus, completed_at: new Date().toISOString() }
            : task
        )
      )

      startTransition(async () => {
        await completeTask(taskId)
      })
    },
    []
  )

  const handleUncomplete = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: "pending" as TaskStatus, completed_at: null }
            : task
        )
      )

      startTransition(async () => {
        await updateTask(taskId, { status: "pending" })
      })
    },
    []
  )

  const handleTaskCreated = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task])
    setShowCreateForm(false)
  }, [])

  const handleTaskUpdated = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    setEditingTask(null)
  }, [])

  const groupConfig: {
    key: TaskGroup
    label: string
    icon: React.ReactNode
    headerClass: string
  }[] = [
    {
      key: "overdue",
      label: t.tasks.overdue,
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      headerClass: "text-red-700 bg-red-50",
    },
    {
      key: "today",
      label: t.tasks.dueToday,
      icon: <CalendarDays className="h-4 w-4 text-amber-500" />,
      headerClass: "text-amber-700 bg-amber-50",
    },
    {
      key: "upcoming",
      label: t.tasks.upcoming,
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      headerClass: "text-blue-700 bg-blue-50",
    },
    {
      key: "no_date",
      label: locale === "es" ? "Sin fecha" : "No date",
      icon: <Circle className="h-4 w-4 text-gray-400" />,
      headerClass: "text-gray-700 bg-gray-50",
    },
    {
      key: "completed",
      label: locale === "es" ? "Completadas" : "Completed",
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      headerClass: "text-green-700 bg-green-50",
    },
  ]

  const statusTabs = [
    { value: "all" as const, label: t.common.all },
    ...TASK_STATUSES.map((s) => ({ value: s.value, label: s.label[locale] })),
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value as TaskStatus | "all")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4" />
            {t.tasks.newTask}
          </Button>
        </div>
      </div>

      {/* Task groups */}
      <div className="flex flex-col gap-3">
        {groupConfig.map(({ key, label, icon, headerClass }) => {
          const items = grouped[key]
          if (items.length === 0 && key !== "today") return null

          return (
            <div key={key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(key)}
                className={cn(
                  "flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold transition-colors",
                  headerClass
                )}
                aria-expanded={expandedGroups[key]}
              >
                {expandedGroups[key] ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                {icon}
                <span>{label}</span>
                <span className="ml-1 text-xs font-normal opacity-70">
                  ({items.length})
                </span>
              </button>

              {/* Task items */}
              {expandedGroups[key] && (
                <div className="divide-y divide-gray-100">
                  {items.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      {t.tasks.noTasks}
                    </div>
                  ) : (
                    items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        locale={locale}
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        onClick={() => setEditingTask(task)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Create form dialog */}
      <TaskForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSaved={handleTaskCreated}
        teamMembers={teamMembers}
        contacts={contacts}
      />

      {/* Edit form dialog */}
      {editingTask && (
        <TaskForm
          open={true}
          onClose={() => setEditingTask(null)}
          onSaved={handleTaskUpdated}
          task={editingTask}
          teamMembers={teamMembers}
          contacts={contacts}
        />
      )}
    </div>
  )
}

/* ------ Single Task Row ------ */

function TaskRow({
  task,
  locale,
  onComplete,
  onUncomplete,
  onClick,
}: {
  task: Task
  locale: "es" | "en"
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onClick: () => void
}) {
  const isCompleted = task.status === "completed"
  const priorityConfig = PRIORITIES.find((p) => p.value === task.priority)
  const contactName = task.contact
    ? `${task.contact.first_name} ${task.contact.last_name}`
    : null

  const isOverdue =
    !isCompleted && task.due_date && new Date(task.due_date) < new Date()

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group",
        isCompleted && "opacity-60"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={task.title}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (isCompleted) { onUncomplete(task.id) } else { onComplete(task.id) }
        }}
        className={cn(
          "shrink-0 rounded-full transition-colors",
          isCompleted
            ? "text-green-500 hover:text-green-600"
            : "text-gray-300 hover:text-veloce-500"
        )}
        aria-label={isCompleted ? "Marcar pendiente" : "Completar"}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium text-gray-900 truncate",
            isCompleted && "line-through text-gray-500"
          )}
        >
          {task.title}
        </p>
        {contactName && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{contactName}</p>
        )}
      </div>

      {/* Due date */}
      {task.due_date && (
        <span
          className={cn(
            "text-xs shrink-0",
            isOverdue ? "text-red-600 font-medium" : "text-gray-500"
          )}
        >
          {formatRelativeTime(task.due_date, locale)}
        </span>
      )}

      {/* Priority badge */}
      {priorityConfig && (
        <Badge
          color={priorityConfig.color}
          className="text-[10px] px-1.5 py-0 shrink-0"
        >
          {priorityConfig.label[locale]}
        </Badge>
      )}

      {/* Assigned avatar */}
      {task.assigned_member && (
        <Avatar
          src={task.assigned_member.avatar_url}
          firstName={task.assigned_member.full_name?.split(" ")[0] || ""}
          lastName={task.assigned_member.full_name?.split(" ")[1] || ""}
          size="sm"
          className="h-6 w-6 text-[9px] shrink-0"
          title={task.assigned_member.full_name}
        />
      )}
    </div>
  )
}
