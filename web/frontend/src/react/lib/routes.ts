import {
  Calendar,
  ChartBar,
  ChatCircle,
  ClipboardText,
  Gauge,
  Gear,
  ListChecks,
  MagnifyingGlass,
  Pulse,
  ShieldCheck,
  TrendUp,
  Users,
  Wallet,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

export interface AppRoute {
  path: string
  key: string
  titleKey: string
  icon: Icon
}

export const appRoutes: AppRoute[] = [
  { path: '/', key: 'dashboard', titleKey: 'menu.dashboard', icon: Gauge },
  { path: '/analyze', key: 'analyze', titleKey: 'menu.analyze', icon: TrendUp },
  { path: '/screener', key: 'screener', titleKey: 'menu.screener', icon: MagnifyingGlass },
  { path: '/holdings', key: 'holdings', titleKey: 'menu.holdings', icon: ClipboardText },
  { path: '/schedule', key: 'schedule', titleKey: 'menu.schedule', icon: Calendar },
  { path: '/paper', key: 'paper', titleKey: 'menu.paper', icon: Wallet },
  { path: '/backtest', key: 'backtest', titleKey: 'menu.backtest', icon: ChartBar },
  { path: '/quality', key: 'quality', titleKey: 'menu.quality', icon: ShieldCheck },
  { path: '/history', key: 'history', titleKey: 'menu.history', icon: ListChecks },
  { path: '/chat', key: 'chat', titleKey: 'chat.title', icon: ChatCircle },
  { path: '/users', key: 'users', titleKey: 'users.title', icon: Users },
  { path: '/settings', key: 'settings', titleKey: 'menu.settings', icon: Gear },
]

export function titleKeyForPath(pathname: string) {
  if (pathname.startsWith('/progress/')) return 'progress.title'
  if (pathname.startsWith('/report/')) return 'report.title'
  return appRoutes.find((route) => route.path === pathname)?.titleKey || 'app.currentPage'
}

export { Pulse }
