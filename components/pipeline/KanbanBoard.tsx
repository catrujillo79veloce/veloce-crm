"use client"

import React, { useCallback, useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"

export interface KanbanColumnData<T = unknown> {
  id: string
  title: string
  color: string
  items: T[]
  sumLabel?: string
}

export interface KanbanBoardProps<T extends { id: string }> {
  columns: KanbanColumnData<T>[]
  onCardMove: (cardId: string, newColumnId: string, newPosition: number) => void
  renderCard: (item: T) => React.ReactNode
  renderOverlay?: (item: T) => React.ReactNode
  className?: string
}

export function KanbanBoard<T extends { id: string }>({
  columns,
  onCardMove,
  renderCard,
  renderOverlay,
  className,
}: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    })
  )

  const activeItem = useMemo(() => {
    if (!activeId) return null
    for (const column of columns) {
      const found = column.items.find((item) => item.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, columns])

  const findColumnByItemId = useCallback(
    (itemId: UniqueIdentifier): string | null => {
      const col = columns.find((c) => c.id === itemId)
      if (col) return col.id
      for (const column of columns) {
        if (column.items.some((item) => item.id === itemId)) {
          return column.id
        }
      }
      return null
    },
    [columns]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Placeholder for real-time column highlighting (handled by useDroppable)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const activeColumnId = findColumnByItemId(active.id)
      let overColumnId = findColumnByItemId(over.id)

      if (!activeColumnId) return

      // If dropped on a column id directly (empty area)
      const isOverColumn = columns.some((c) => c.id === over.id)
      if (isOverColumn) {
        overColumnId = over.id as string
      }

      if (!overColumnId) return

      const overColumn = columns.find((c) => c.id === overColumnId)
      if (!overColumn) return

      let newPosition: number

      if (isOverColumn) {
        // Dropped on column empty area -> append at end
        newPosition = overColumn.items.length
      } else {
        const overIndex = overColumn.items.findIndex((item) => item.id === over.id)
        if (activeColumnId === overColumnId) {
          const activeIndex = overColumn.items.findIndex((item) => item.id === active.id)
          if (activeIndex === overIndex) return
        }
        newPosition = overIndex >= 0 ? overIndex : overColumn.items.length
      }

      onCardMove(active.id as string, overColumnId, newPosition)
    },
    [columns, findColumnByItemId, onCardMove]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={cn(
          "flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-240px)]",
          "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent",
          className
        )}
        role="region"
        aria-label="Kanban board"
      >
        {columns.map((column) => (
          <DroppableColumn key={column.id} column={column} activeId={activeId}>
            {column.items.map((item) => (
              <SortableCard key={item.id} id={item.id} isDragActive={activeId === item.id}>
                {renderCard(item)}
              </SortableCard>
            ))}
          </DroppableColumn>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {activeItem ? (
          <div className="rotate-[2deg] scale-105 cursor-grabbing">
            {renderOverlay ? renderOverlay(activeItem) : renderCard(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/* ------ Droppable Column ------ */

function DroppableColumn<T extends { id: string }>({
  column,
  activeId,
  children,
}: {
  column: KanbanColumnData<T>
  activeId: UniqueIdentifier | null
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const itemIds = useMemo(() => column.items.map((i) => i.id), [column.items])

  return (
    <div className="flex flex-col shrink-0 w-[300px] min-w-[280px] max-w-[320px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
          aria-hidden="true"
        />
        <h3 className="text-sm font-semibold text-gray-700 truncate">
          {column.title}
        </h3>
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
          {column.items.length}
        </span>
        {column.sumLabel && (
          <span className="ml-auto text-xs font-medium text-gray-500 truncate">
            {column.sumLabel}
          </span>
        )}
      </div>

      {/* Card area */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 flex flex-col gap-2 p-2 rounded-xl transition-colors min-h-[120px]",
            "bg-gray-50/80",
            isOver && "bg-veloce-50/60 ring-2 ring-veloce-200 ring-inset"
          )}
          role="list"
          aria-label={column.title}
        >
          {children}
          {column.items.length === 0 && !activeId && (
            <div className="flex-1 flex items-center justify-center py-8">
              <p className="text-xs text-gray-400 select-none">Sin items</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

/* ------ Sortable Card Wrapper ------ */

function SortableCard({
  id,
  isDragActive,
  children,
}: {
  id: string
  isDragActive: boolean
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    pointerEvents: isDragActive && !isDragging ? "none" : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
    >
      {children}
    </div>
  )
}
