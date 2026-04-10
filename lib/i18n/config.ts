"use client"

import { createContext, useContext } from "react"
import es from "./es.json"
import en from "./en.json"

export type Locale = "es" | "en"

const translations = { es, en }

export type TranslationKeys = typeof es

export interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationKeys
}

export const I18nContext = createContext<I18nContextType>({
  locale: "es",
  setLocale: () => {},
  t: es,
})

export function useI18n() {
  return useContext(I18nContext)
}

export function getTranslations(locale: Locale): TranslationKeys {
  return translations[locale]
}
