import { Button, Input, Label } from '@cloudflare/kumo'
import { EnvelopeSimple } from '@phosphor-icons/react'
import { useCallback, useRef, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'

export function ForgotPasswordPage() {
  const { t, locale, setLocale } = useI18n()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')

      if (!email.trim()) {
        setError(t('login.fieldsRequired'))
        return
      }

      setLoading(true)
      try {
        await api.post('/api/auth/forgot-password', { email: email.trim() })
        setSent(true)
      } catch {
        setError(t('login.networkError'))
      } finally {
        setLoading(false)
      }
    },
    [email, t],
  )

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo-mark">TV</div>
            <h1 className="auth-title">{t('forgotPassword.title')}</h1>
            <p className="auth-subtitle">{t('forgotPassword.subtitle')}</p>
          </div>

          {sent ? (
            <div className="auth-success-block">
              <div className="auth-success">{t('forgotPassword.successTitle')}</div>
              <p className="auth-success-detail">{t('forgotPassword.successMessage')}</p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error" role="alert">{error}</div>}

              <div className="auth-field">
                <Label htmlFor="forgot-email">{t('forgotPassword.email')}</Label>
                <div className="auth-input-wrap">
                  <EnvelopeSimple size={16} className="auth-input-icon" weight="bold" />
                  <Input
                    ref={emailRef}
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="auth-submit">
                <Button type="submit" disabled={loading} className="auth-submit-btn">
                  {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                </Button>
              </div>
            </form>
          )}

          <div className="auth-links">
            <Link to="/login" className="auth-link">{t('forgotPassword.backToLogin')}</Link>
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
