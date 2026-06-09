import type { BadgeVariant } from '@cloudflare/kumo'

export function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) return response.data.detail
  }
  if (error instanceof Error) return error.message
  return fallback
}

export function signalBadgeVariant(signal?: string): BadgeVariant {
  if (signal === 'BUY') return 'success'
  if (signal === 'SELL') return 'error'
  if (signal === 'HOLD') return 'warning'
  return 'secondary'
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function formatCurrency(value: number | null | undefined, placeholder = '-'): string {
  if (value == null) return placeholder
  return value.toFixed(2)
}

export function formatCurrencySigned(value: number | null | undefined, placeholder = '-'): string {
  if (value == null) return placeholder
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

export function formatPct(value: number | null | undefined, placeholder = '-'): string {
  if (value == null) return placeholder
  return `${value.toFixed(2)}%`
}

export function formatPctSigned(value: number | null | undefined, placeholder = '-'): string {
  if (value == null) return placeholder
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function marketColorClass(value: number | null | undefined): string | undefined {
  if (value == null) return undefined
  return value >= 0 ? 'market-up' : 'market-down'
}
