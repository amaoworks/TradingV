import {
  Button,
  LinkProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  Tooltip,
  TooltipProvider,
  useSidebar,
} from '@cloudflare/kumo'
import {
  List,
  MagnifyingGlass,
  Moon,
  RocketLaunch,
  SignOut,
  Sun,
  TrendUp,
} from '@phosphor-icons/react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  forwardRef,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { useAuth } from './AuthProvider'
import { appRoutes } from '../lib/routes'

const RouterLink = forwardRef<
  HTMLAnchorElement,
  AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }
>(function RouterLink({ href, children, ...props }, ref) {
  return (
    <Link ref={ref} to={href || '#'} {...props}>
      {children}
    </Link>
  )
})

export function KumoShell() {
  const { t, locale, setLocale } = useI18n()
  const { logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('appearance')
    if (saved === 'dark') return true
    if (saved === 'light') return false
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  const [marketTheme, setMarketTheme] = useState<'red' | 'green'>(() => {
    const saved = localStorage.getItem('themeColor')
    return saved === 'green' ? 'green' : 'red'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = 'kumo'
    document.documentElement.dataset.mode = dark ? 'dark' : 'light'
    localStorage.setItem('appearance', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    document.documentElement.dataset.marketTheme = marketTheme
    localStorage.setItem('themeColor', marketTheme)
  }, [marketTheme])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])


  return (
    <TooltipProvider>
      <LinkProvider component={RouterLink}>
        <SidebarProvider resizable={true} defaultWidth={256} minWidth={180} maxWidth={380}>
          <div className="kumo-app">
            <Sidebar className="kumo-sidebar">
              <SidebarHeader>
                <Link to="/" className="kumo-brand">
                  <span className="kumo-brand-mark">TV</span>
                  <span>
                    <strong>TradingV</strong>
                    <small>AI Trading Workspace</small>
                  </span>
                </Link>
              </SidebarHeader>

              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>{t('app.workspace')}</SidebarGroupLabel>
                  <SidebarMenu>
                    {appRoutes.map((route) => {
                      const isActive =
                        location.pathname === route.path ||
                        (route.path === '/history' && location.pathname.startsWith('/report/')) ||
                        (route.path === '/analyze' && location.pathname.startsWith('/progress/'))
                      return (
                        <ShellMenuItem
                          key={route.key}
                          route={route}
                          isActive={isActive}
                        />
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>

              <SidebarFooter>
                <div className="kumo-sidebar-tools">
                  <ShellSidebarTrigger />
                  <ShellButton
                    aria-label={t('app.switchLanguage')}
                    title={t('app.switchLanguage')}
                    onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
                  >
                    <span className="kumo-lang-code">{locale === 'zh-CN' ? 'EN' : '中'}</span>
                  </ShellButton>
                  <ShellButton
                    aria-label={dark ? t('app.lightMode') : t('app.darkMode')}
                    title={dark ? t('app.lightMode') : t('app.darkMode')}
                    onClick={() => setDark((value) => !value)}
                  >
                    {dark ? <Sun size={16} /> : <Moon size={16} />}
                  </ShellButton>
                  <ShellButton
                    className="kumo-market-theme-button"
                    aria-label={marketTheme === 'red' ? t('app.themeRed') : t('app.themeGreen')}
                    title={marketTheme === 'red' ? t('app.themeRed') : t('app.themeGreen')}
                    onClick={() => setMarketTheme((value) => (value === 'red' ? 'green' : 'red'))}
                  >
                    <span className="market-up" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <TrendUp size={16} weight="bold" />
                    </span>
                  </ShellButton>
                  <ShellButton
                    aria-label={t('login.logout')}
                    title={t('login.logout')}
                    onClick={() => { logout(); navigate('/login', { replace: true }); }}
                  >
                    <SignOut size={16} />
                  </ShellButton>
                </div>
              </SidebarFooter>
              <Sidebar.ResizeHandle />
            </Sidebar>

            <div className="kumo-main">
              <header className="kumo-topbar">
                <SidebarTrigger
                  className="kumo-mobile-menu-trigger"
                  aria-label={t('app.expandSidebar')}
                  title={t('app.expandSidebar')}
                >
                  <List size={18} />
                </SidebarTrigger>
                <div className="kumo-topbar-title">
                  <h1 className="kumo-console-title">{t('app.console')}</h1>
                </div>
                <div className="kumo-topbar-actions">
                  <Button variant="secondary" icon={MagnifyingGlass} onClick={() => navigate('/screener')}>
                    {t('menu.screener')}
                  </Button>
                  <Button icon={RocketLaunch} onClick={() => navigate('/analyze')}>
                    {t('menu.analyze')}
                  </Button>
                </div>
              </header>

              <main className="kumo-content">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </LinkProvider>
    </TooltipProvider>
  )
}

function ShellSidebarTrigger() {
  const { open } = useSidebar()
  const { t } = useI18n()
  const label = open ? t('app.collapseSidebar') : t('app.expandSidebar')

  return (
    <SidebarTrigger className="kumo-shell-button" aria-label={label} title={label} />
  )
}

function ShellMenuItem({
  route,
  isActive,
}: {
  route: typeof appRoutes[number]
  isActive: boolean
}) {
  const { t } = useI18n()
  const Icon = route.icon

  const button = (
    <SidebarMenuButton
      href={route.path}
      active={isActive}
      icon={Icon}
    >
      {t(route.titleKey)}
    </SidebarMenuButton>
  )

  return (
    <SidebarMenuItem>
      <Tooltip
        content={t(route.titleKey)}
        side="right"
        render={<div className="w-full flex" />}
      >
        {button}
      </Tooltip>
    </SidebarMenuItem>
  )
}

function ShellButton({
  children,
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type={type ?? 'button'}
      className={['kumo-shell-button', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
