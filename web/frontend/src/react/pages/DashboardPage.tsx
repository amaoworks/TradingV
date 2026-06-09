import { Badge, Button, Empty } from '@cloudflare/kumo'
import { ArrowRight, FolderSimpleDashed, Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useI18n } from '../i18n/I18nProvider'
import { PageHeader, SectionCard } from '../components/Page'

interface AnalysisItem {
  id: string
  ticker: string
  trade_date: string
  asset_type: string
  status: string
  signal?: string
  confidence?: number
  created_at: string
  completed_at?: string
}

interface DashboardData {
  recent?: AnalysisItem[]
  signal_distribution?: Record<string, number>
}

export function DashboardPage() {
  const { t } = useI18n()
  const [recent, setRecent] = useState<AnalysisItem[]>([])
  const [signalDistribution, setSignalDistribution] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get<DashboardData>('/api/dashboard')
      .then(({ data }) => {
        if (!active) return
        setRecent(data.recent || [])
        setSignalDistribution(data.signal_distribution || {})
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : t('common.unknownError'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [t])

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <Link to="/analyze" className="kumo-link-reset">
            <Button icon={Plus}>
              {t('dashboard.quickNew')}
            </Button>
          </Link>
        }
      />

      <SectionCard title={t('dashboard.sysStatus')}>
        <div className="kumo-status-row">
          <Badge variant="success">{t('dashboard.apiConnected')}</Badge>
          {loading ? <Badge>{t('common.saving')}</Badge> : null}
          {error ? <Badge variant="destructive">{error}</Badge> : null}
        </div>
      </SectionCard>

      <SectionCard
        title={t('dashboard.recent')}
        extra={<Badge>{Object.keys(signalDistribution).length || 'N/A'}</Badge>}
      >
        {recent.length ? (
          <div className="kumo-list">
            {recent.map((item) => (
              <Link key={item.id} to={`/report/${item.id}`} className="kumo-list-item">
                <div>
                  <strong>{item.ticker}</strong>
                  <span>{item.trade_date} · {item.asset_type}</span>
                </div>
                <div className="kumo-list-meta">
                  <Badge>{item.signal || item.status}</Badge>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            size="sm"
            icon={loading ? undefined : <FolderSimpleDashed size={24} />}
            title={t('dashboard.noRecent')}
            description={loading ? t('common.saving') : undefined}
            className="kumo-empty-dashed"
          />
        )}
      </SectionCard>
    </div>
  )
}
