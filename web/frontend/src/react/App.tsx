import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import { KumoShell } from './components/KumoShell'
import { DashboardPage } from './pages/DashboardPage'
import { AnalyzePage } from './pages/AnalyzePage'
import { BacktestPage } from './pages/BacktestPage'
import { HistoryPage } from './pages/HistoryPage'
import { HoldingsPage } from './pages/HoldingsPage'
import { PaperPage } from './pages/PaperPage'
import { ProgressPage } from './pages/ProgressPage'
import { QualityPage } from './pages/QualityPage'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { SchedulePage } from './pages/SchedulePage'
import { ScreenerPage } from './pages/ScreenerPage'
import { SettingsPage } from './pages/SettingsPage'

export function ReactApp() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<KumoShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="analyze" element={<AnalyzePage />} />
            <Route path="holdings" element={<HoldingsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="screener" element={<ScreenerPage />} />
            <Route path="paper" element={<PaperPage />} />
            <Route path="backtest" element={<BacktestPage />} />
            <Route path="quality" element={<QualityPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="progress/:id" element={<ProgressPage />} />
            <Route path="report/:id" element={<ReportDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}
