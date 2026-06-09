import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nProvider'
import { AuthProvider, useAuth } from './components/AuthProvider'
import { KumoShell } from './components/KumoShell'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ChatPage } from './pages/ChatPage'
import { UsersPage } from './pages/UsersPage'
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
import type { ReactNode } from 'react'

/** Redirect to /login when not authenticated */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function ReactApp() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Protected routes */}
            <Route
              element={
                <RequireAuth>
                  <KumoShell />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="analyze" element={<AnalyzePage />} />
              <Route path="holdings" element={<HoldingsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="screener" element={<ScreenerPage />} />
              <Route path="paper" element={<PaperPage />} />
              <Route path="backtest" element={<BacktestPage />} />
              <Route path="quality" element={<QualityPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="progress/:id" element={<ProgressPage />} />
              <Route path="report/:id" element={<ReportDetailPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
