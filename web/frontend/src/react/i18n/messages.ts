import en from '../../i18n/locales/en-US'
import zh from '../../i18n/locales/zh-CN'

export type Locale = 'zh-CN' | 'en-US'

export const messages = {
  'zh-CN': zh,
  'en-US': en,
} as const

export function initialLocale(): Locale {
  const saved = localStorage.getItem('locale')
  if (saved === 'zh-CN' || saved === 'en-US') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function translate(locale: Locale, path: string, params?: Record<string, string | number>) {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && key in node) {
      return (node as Record<string, unknown>)[key]
    }
    return undefined
  }, messages[locale])

  if (typeof value !== 'string') return path

  if (!params) return value
  return Object.entries(params).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value,
  )
}
