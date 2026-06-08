import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { initialLocale, translate, type Locale } from './messages'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (path: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [localeState, setLocaleState] = useState<Locale>(() => initialLocale())

  const value = useMemo<I18nContextValue>(() => ({
    locale: localeState,
    setLocale(next) {
      localStorage.setItem('locale', next)
      setLocaleState(next)
    },
    t(path, params) {
      return translate(localeState, path, params)
    },
  }), [localeState])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}
