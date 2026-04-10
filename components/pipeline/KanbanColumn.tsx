"use client"

import React from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"

export interface KanbanColumnProps {
  id: string
  title: string
  color: string
  count: number
  itemIds: string[]
  sumLabel?: string
  children: React.ReactNode
  className?: string
}

function KanbanColumn({
  id,
  title,
  color,
  count,
  itemIds,
  sumLabel,
  children,
  className,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      className={cn(
        "flex flex-col shrink-0 w-[300px] min-w-[280px] max-w-[320px]",
        className
      )}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-gray-700 truncate">{title}</h3>
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
          {count}
        </span>
        {sumLabel && (
          <span className="ml-auto text-xs font-medium text-gray-500 truncate">
            {sumLabel}
          </span>
        )}
      </div>

      {/* Droppable area */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 flex flex-col gap-2 p-2 rounded-xl transition-colors min-h-[120px]",
            "bg-gray-50/80",
            isOver && "bg-veloce-50/60 ring-2 ring-veloce-200 ring-inset"
          )}
          role="list"
          aria-label={title}
        >
          {children}
          {itemIds.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-xs text-gray-400 select-none">Sin items</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export { KanbanColumn }
