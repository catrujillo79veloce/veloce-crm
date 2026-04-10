"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error("Tabs components must be used within <Tabs>")
  return ctx
}

export interface TabsProps {
  defaultValue: string
  value?: string
  onChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

function Tabs({ defaultValue, value, onChange, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeTab = value ?? internalValue

  const setActiveTab = useCallback(
    (v: string) => {
      if (!value) setInternalValue(v)
      onChange?.(v)
    },
    [value, onChange]
  )

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex gap-1 border-b border-gray-200",
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

function Tab({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { activeTab, setActiveTab } = useTabsContext()
  const isActive = activeTab === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cn(
        "relative px-4 py-2 text-sm font-medium transition-colors",
        "hover:text-gray-900",
        isActive
          ? "text-veloce-600"
          : "text-gray-500",
        className
      )}
      onClick={() => setActiveTab(value)}
    >
      {children}
      {isActive && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-veloce-500" />
      )}
    </button>
  )
}

function TabPanel({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { activeTab } = useTabsContext()
  if (activeTab !== value) return null

  return (
    <div role="tabpanel" className={cn("py-4", className)}>
      {children}
    </div>
  )
}

export { Tabs, TabList, Tab, TabPanel }
