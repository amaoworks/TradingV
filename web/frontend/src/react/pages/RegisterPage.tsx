import { Button, Input, Label } from '@cloudflare/kumo'
import { EnvelopeSimple, Lock, User } from '@phosphor-icons/react'
import { useCallback, useRef, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'

export function RegisterPage() {
  const { t, locale, setLocale } = useI18n()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    usernameRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')

      if (!username.trim() || !email.trim() || !password) {
        setError(t('login.fieldsRequired'))
        return
      }

      if (password !== confirmPassword) {
        setError(t('register.passwordMismatch'))
        return
      }

      setLoading(true)
      try {
        await api.post('/api/auth/register', {
          username: username.trim(),
          email: email.trim(),
          password,
        })
        navigate('/login', { replace: true })
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'response' in err
        ) {
          const resp = (err as { response?: { status?: number; data?: { detail?: string } } }).response
          if (resp?.status === 409) {
            setError(t('register.usernameTaken'))
          } else {
            setError(resp?.data?.detail || t('login.networkError'))
          }
        } else {
          setError(t('login.networkError'))
        }
      } finally {
        setLoading(false)
      }
    },
    [username, email, password, confirmPassword, navigate, t],
  )

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-mark">TV</div>
            <h1 className="auth-title">{t('register.title')}</h1>
            <p className="auth-subtitle">{t('register.subtitle')}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
            {error && <div className="auth-error" role="alert">{error}</div>}

            <div className="auth-field">
              <Label htmlFor="reg-username">{t('register.username')}</Label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" weight="bold" />
                <Input
                  ref={usernameRef}
                  id="reg-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder={t('register.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <Label htmlFor="reg-email">{t('register.email')}</Label>
              <div className="auth-input-wrap">
                <EnvelopeSimple size={16} className="auth-input-icon" weight="bold" />
                <Input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('register.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <Label htmlFor="reg-password">{t('register.password')}</Label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" weight="bold" />
                <Input
                  id="reg-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('register.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-field">
              <Label htmlFor="reg-confirm">{t('register.confirmPassword')}</Label>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" weight="bold" />
                <Input
                  id="reg-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('register.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="auth-submit">
              <Button type="submit" disabled={loading} className="auth-submit-btn">
                {loading ? t('register.signingUp') : t('register.signUp')}
              </Button>
            </div>
          </form>

          <div className="auth-links">
            <Link to="/login" className="auth-link">{t('register.haveAccount')}</Link>
          </div>
        </div>

        <div className="auth-footer">
          <button type="button" className="auth-footer-btn" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
            {locale === 'zh-CN' ? 'English' : '中文'}
          </button>
          <span className="auth-copyright">© {new Date().getFullYear()} TradingV</span>
        </div>
      </div>
    </div>
  )
}
