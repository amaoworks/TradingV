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
  SidebarRail,
  SidebarTrigger,
  TooltipProvider,
} from '@cloudflare/kumo'
import {
  CaretLeft,
  GlobeHemisphereEast,
  Moon,
  Palette,
  RocketLaunch,
  Sun,
} from '@phosphor-icons/react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { appRoutes, titleKeyForPath } from '../lib/routes'

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
  const location = useLocation()
  const navigate = useNavigate()
  const [dark, setDark] = useState(localStorage.getItem('appearance') === 'dark')
  const [marketTheme, setMarketTheme] = useState(localStorage.getItem('themeColor') || 'red')

  useEffect(() => {
    document.documentElement.dataset.mode = dark ? 'dark' : 'light'
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    localStorage.setItem('appearance', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    localStorage.setItem('themeColor', marketTheme)
  }, [marketTheme])

  const currentTitle = useMemo(
    () => t(titleKeyForPath(location.pathname)),
    [location.pathname, t],
  )

  return (
    <TooltipProvider>
      <LinkProvider component={RouterLink}>
        <SidebarProvider>
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
                      const Icon = route.icon
                      return (
                        <SidebarMenuItem key={route.key}>
                          <SidebarMenuButton
                            href={route.path}
                            active={location.pathname === route.path}
                            icon={<Icon size={18} />}
                            tooltip={t(route.titleKey)}
                          >
                            {t(route.titleKey)}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>

              <SidebarFooter>
                <div className="kumo-sidebar-tools">
                  <SidebarTrigger>
                    <CaretLeft size={16} />
                  </SidebarTrigger>
                  <ShellButton onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
                    <GlobeHemisphereEast size={16} />
                    <span>{locale === 'zh-CN' ? 'EN' : '中'}</span>
                  </ShellButton>
                  <ShellButton onClick={() => setDark((value) => !value)}>
                    {dark ? <Sun size={16} /> : <Moon size={16} />}
                  </ShellButton>
                  <ShellButton onClick={() => setMarketTheme((value) => (value === 'red' ? 'green' : 'red'))}>
                    <Palette size={16} />
                  </ShellButton>
                </div>
              </SidebarFooter>
              <SidebarRail />
            </Sidebar>

            <div className="kumo-main">
              <header className="kumo-topbar">
                <div className="kumo-topbar-title">
                  <p>{t('app.console')}</p>
                  <h1>{currentTitle}</h1>
                </div>
                <div className="kumo-topbar-actions">
                  <Button variant="secondary" onClick={() => navigate('/screener')}>
                    {t('menu.screener')}
                  </Button>
                  <Button onClick={() => navigate('/analyze')}>
                    <RocketLaunch size={16} />
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

function ShellButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="kumo-shell-button" onClick={onClick}>
      {children}
    </button>
  )
}
