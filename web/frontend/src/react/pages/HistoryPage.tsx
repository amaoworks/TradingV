import { Badge, Button, Input, Select, Table } from '@cloudflare/kumo'
import { Plus } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, PaginationBar, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage, signalBadgeVariant } from '../lib/format'
import type { AnalysisItem, PagedResponse } from '../lib/types'

interface HistoryFilters {
  ticker: string
  signal: string
  dateFrom: string
  dateTo: string
}

const pageSize = 20

export function HistoryPage() {
  const { t } = useI18n()
  const [filters, setFilters] = useState<HistoryFilters>({
    ticker: '',
    signal: '',
    dateFrom: '',
    dateTo: '',
  })
  const [items, setItems] = useState<AnalysisItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  async function load(nextPage = page) {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<PagedResponse<AnalysisItem>>('/api/history', {
        params: {
          ticker: filters.ticker || undefined,
          signal: filters.signal || undefined,
          from: filters.dateFrom || undefined,
          to: filters.dateTo || undefined,
          page: nextPage,
          size: pageSize,
        },
      })
      setItems(data.items || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  function updateFilter<K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  async function deleteReport(id: string) {
    if (!window.confirm(t('history.confirmDeleteContent'))) return
    await api.delete(`/api/reports/${id}`)
    load()
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        actions={
          <Link to="/analyze" className="kumo-link-reset">
            <Button>
              <Plus size={16} />
              {t('history.newAnalysis')}
            </Button>
          </Link>
        }
      />
      <ErrorBanner message={error} />
      <SectionCard>
        <div className="kumo-filter-row">
          <Input
            label={t('history.cols.ticker')}
            value={filters.ticker}
            placeholder={t('history.tickerPlaceholder')}
            onChange={(event) => updateFilter('ticker', event.currentTarget.value.toUpperCase())}
          />
          <Select
            label={t('history.signal')}
            value={filters.signal}
            placeholder={t('history.signal')}
            items={[
              { label: 'BUY', value: 'BUY' },
              { label: 'HOLD', value: 'HOLD' },
              { label: 'SELL', value: 'SELL' },
            ]}
            onValueChange={(value) => updateFilter('signal', String(value || ''))}
          />
          <Input
            type="date"
            label={t('history.dateFrom')}
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.currentTarget.value)}
          />
          <Input
            type="date"
            label={t('history.dateTo')}
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.currentTarget.value)}
          />
          <Button onClick={() => {
            setPage(1)
            load(1)
          }}>
            {t('common.refresh')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard>
        {items.length ? (
          <>
            <KumoTable>
              <Table.Header>
                <Table.Row>
                  <Table.Head>{t('history.cols.ticker')}</Table.Head>
                  <Table.Head>{t('history.cols.date')}</Table.Head>
                  <Table.Head>{t('history.cols.signal')}</Table.Head>
                  <Table.Head>{t('history.cols.confidence')}</Table.Head>
                  <Table.Head>{t('history.cols.createdAt')}</Table.Head>
                  <Table.Head>{t('history.cols.actions')}</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>{item.ticker}</Table.Cell>
                    <Table.Cell>{item.trade_date}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={signalBadgeVariant(item.signal)}>
                        {item.signal || item.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{item.confidence ? `${item.confidence}%` : '-'}</Table.Cell>
                    <Table.Cell>{item.created_at}</Table.Cell>
                    <Table.Cell>
                      <div className="kumo-row-actions">
                        <Link to={`/report/${item.id}`} className="kumo-link-reset">
                          <Button size="sm">{t('history.detail')}</Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="secondary-destructive"
                          onClick={() => deleteReport(item.id)}
                        >
                          {t('history.delete')}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </KumoTable>
            <PaginationBar page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
          </>
        ) : (
          <LoadingEmpty loading={loading} title={t('common.empty')} />
        )}
      </SectionCard>
    </div>
  )
}
