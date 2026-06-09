import { Button, Input, Label } from '@cloudflare/kumo'
import { Eye, EyeSlash, Lock, User } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'

export function LoginPage() {
  const { t, locale, setLocale } = useI18n()
  const { login, isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')

      if (!username.trim() || !password) {
        setError(t('login.fieldsRequired'))
        return
      }

      setLoading(true)
      try {
        const { data } = await api.post<{
          access_token: string
          user: { username: string; email?: string; avatar?: string }
        }>('/api/auth/login', { username: username.trim(), password })

        login(data.access_token, data.user)
        navigate('/', { replace: true })
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 401
        ) {
          setError(t('login.invalidCredentials'))
        } else {
          setError(t('login.networkError'))
        }
      } finally {
        setLoading(false)
      }
    },
    [username, password, login, navigate, t],
  )

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo-mark">TV</div>
            <h1 className="auth-title">TradingV</h1>
            <p className="auth-subtitle">{t('login.subtitle')}</p>
          </div>

          {/* Form */}
          <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
            {error && (
              <div className="auth-error" role="alert">{error}</div>
            )}

            <div className="auth-field">
              <Label htmlFor="login-username">{t('login.username')}</Label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" weight="bold" />
                <Input
                  ref={usernameRef}
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder={t('login.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <Label htmlFor="login-password">{t('login.password')}</Label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" weight="bold" />
                <Input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder={t('login.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-eye-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth-submit">
              <Button type="submit" disabled={loading} className="auth-submit-btn">
                {loading ? t('login.loggingIn') : t('login.signIn')}
              </Button>
            </div>
          </form>

          {/* Links */}
          <div className="auth-links">
            <Link to="/register" className="auth-link">{t('login.noAccount')}</Link>
            <Link to="/forgot-password" className="auth-link">{t('login.forgotPassword')}</Link>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <button
            type="button"
            className="auth-footer-btn"
            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
          >
            {locale === 'zh-CN' ? 'English' : '中文'}
          </button>
          <span className="auth-copyright">© {new Date().getFullYear()} TradingV</span>
        </div>
      </div>
    </div>
  )
}
