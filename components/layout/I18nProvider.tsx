"use client"

import { useState, useEffect, type ReactNode } from "react"
import { I18nContext, type Locale, getTranslations } from "@/lib/i18n/config"

const LOCALE_STORAGE_KEY = "veloce-crm-locale"

interface I18nProviderProps {
  children: ReactNode
}

export default function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>("es")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
    if (stored && (stored === "es" || stored === "en")) {
      setLocaleState(stored)
    }
    setMounted(true)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
  }

  const t = getTranslations(locale)

  // Prevent hydration mismatch by rendering with default locale on server
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: "es", setLocale, t: getTranslations("es") }}>
        {children}
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}
