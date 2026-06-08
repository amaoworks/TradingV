import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import { KumoShell } from './components/KumoShell'
import { DashboardPage } from './pages/DashboardPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { appRoutes } from './lib/routes'

function DynamicPlaceholder({ type }: { type: 'progress' | 'report' }) {
  const params = useParams()
  return (
    <PlaceholderPage
      titleKey={type === 'progress' ? 'progress.title' : 'report.title'}
      subtitle={type === 'progress' ? params.id : params.id}
    />
  )
}

export function ReactApp() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<KumoShell />}>
            <Route index element={<DashboardPage />} />
            {appRoutes.filter((route) => route.path !== '/').map((route) => (
              <Route
                key={route.key}
                path={route.path.slice(1)}
                element={<PlaceholderPage titleKey={route.titleKey} />}
              />
            ))}
            <Route path="progress/:id" element={<DynamicPlaceholder type="progress" />} />
            <Route path="report/:id" element={<DynamicPlaceholder type="report" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
