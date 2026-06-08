import { LayerCard } from '@cloudflare/kumo'
import { useI18n } from '../i18n/I18nProvider'

interface PlaceholderPageProps {
  titleKey: string
  subtitle?: string
}

export function PlaceholderPage({ titleKey, subtitle }: PlaceholderPageProps) {
  const { t } = useI18n()
  const title = t(titleKey)

  return (
    <div className="kumo-page-stack">
      <header className="kumo-page-header">
        <div>
          <p className="kumo-eyebrow">Kumo migration</p>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>

      <LayerCard className="kumo-card">
        <div className="kumo-placeholder">
          <h2>{title}</h2>
          <p>
            This route is reserved in the React/Kumo migration shell. The Vue
            implementation remains the parity reference until this page is fully
            migrated and verified.
          </p>
        </div>
      </LayerCard>
    </div>
  )
}
