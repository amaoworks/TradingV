import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Dialog,
  Input,
  Radio,
  Select,
  Table,
  Textarea,
} from '@cloudflare/kumo'
import { CalendarPlus, ChartLine, Check, MagnifyingGlass, PencilSimple, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KLineChart } from '../components/KLineChart'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage, signalBadgeVariant, todayIsoDate } from '../lib/format'

interface Holding {
  id: number
  ticker: string
  asset_type: string
  shares: number
  cost_price: number
  open_date: string | null
  notes: string | null
  latest_analysis: {
    id: string
    signal: string | null
    confidence: number | null
    trade_date: string
    created_at: string
  } | null
}

interface Quote {
  ticker?: string
  last_price: number | null
  prev_close: number | null
  market_value: number | null
  pnl_amount: number | null
  pnl_pct: number | null
}

interface HoldingForm {
  ticker: string
  asset_type: string
  shares: number
  cost_price: number
  open_date: string
  notes: string
}

interface ScheduleForm {
  schedule_type: 'interval' | 'daily' | 'weekly'
  interval_minutes: number
  time_of_day: string
  day_of_week: number
  analysts: string[]
}

const defaultHoldingForm: HoldingForm = {
  ticker: '',
  asset_type: 'stock',
  shares: 0,
  cost_price: 0,
  open_date: '',
  notes: '',
}

const defaultScheduleForm: ScheduleForm = {
  schedule_type: 'daily',
  interval_minutes: 60,
  time_of_day: '09:30',
  day_of_week: 0,
  analysts: ['market', 'news', 'fundamentals'],
}

const scheduleAnalysts = ['market', 'news', 'fundamentals', 'cn_social', 'event']

export function HoldingsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [quotes, setQuotes] = useState<Record<number, Quote>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [holdingForm, setHoldingForm] = useState<HoldingForm>(defaultHoldingForm)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(defaultScheduleForm)
  const [scheduling, setScheduling] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [klineTicker, setKlineTicker] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items?: Holding[] }>('/api/holdings')
      const nextHoldings = data.items || []
      setHoldings(nextHoldings)
      const quotePairs = await Promise.all(
        nextHoldings.map(async (holding) => {
          try {
            const { data: quote } = await api.get<Quote>(`/api/holdings/${holding.id}/quote`)
            return [holding.id, quote] as const
          } catch {
            return [holding.id, undefined] as const
          }
        }),
      )
      const nextQuotes: Record<number, Quote> = {}
      for (const [id, quote] of quotePairs) {
        if (quote) nextQuotes[id] = quote
      }
      setQuotes(nextQuotes)
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  const totalMarketValue = useMemo(
    () => holdings.reduce((sum, holding) => sum + (quotes[holding.id]?.market_value || 0), 0),
    [holdings, quotes],
  )
  const totalPnl = useMemo(
    () => holdings.reduce((sum, holding) => sum + (quotes[holding.id]?.pnl_amount || 0), 0),
    [holdings, quotes],
  )
  const avgPnlPct = useMemo(() => {
    const values = holdings
      .map((holding) => quotes[holding.id]?.pnl_pct)
      .filter((value): value is number => value != null)
    if (!values.length) return 0
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [holdings, quotes])

  const dayItems = [
    { label: t('schedule.days.mon'), value: 0 },
    { label: t('schedule.days.tue'), value: 1 },
    { label: t('schedule.days.wed'), value: 2 },
    { label: t('schedule.days.thu'), value: 3 },
    { label: t('schedule.days.fri'), value: 4 },
    { label: t('schedule.days.sat'), value: 5 },
    { label: t('schedule.days.sun'), value: 6 },
  ]

  function openCreate() {
    setEditingId(null)
    setHoldingForm({ ...defaultHoldingForm, open_date: todayIsoDate() })
    setEditOpen(true)
  }

  function openEdit(holding: Holding) {
    setEditingId(holding.id)
    setHoldingForm({
      ticker: holding.ticker,
      asset_type: holding.asset_type,
      shares: holding.shares,
      cost_price: holding.cost_price,
      open_date: holding.open_date || '',
      notes: holding.notes || '',
    })
    setEditOpen(true)
  }

  function updateHolding<K extends keyof HoldingForm>(key: K, value: HoldingForm[K]) {
    setHoldingForm((current) => ({ ...current, [key]: value }))
  }

  async function saveHolding() {
    if (!holdingForm.ticker || holdingForm.shares <= 0 || holdingForm.cost_price <= 0) {
      setError(t('holdings.saveValidation'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await api.put(`/api/holdings/${editingId}`, {
          shares: holdingForm.shares,
          cost_price: holdingForm.cost_price,
          open_date: holdingForm.open_date || null,
          notes: holdingForm.notes,
        })
      } else {
        await api.post('/api/holdings', {
          ...holdingForm,
          ticker: holdingForm.ticker.trim().toUpperCase(),
          open_date: holdingForm.open_date || null,
        })
      }
      setEditOpen(false)
      await load()
    } catch (err) {
      setError(`${t('holdings.saveFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteHolding(holding: Holding) {
    if (!window.confirm(t('holdings.confirmDeleteContent', { ticker: holding.ticker }))) return
    await api.delete(`/api/holdings/${holding.id}`)
    await load()
  }

  function analyzeHolding(holding: Holding) {
    navigate(`/analyze?ticker=${encodeURIComponent(holding.ticker)}&asset_type=${encodeURIComponent(holding.asset_type)}`)
  }

  async function bulkSchedule() {
    setScheduling(true)
    setError('')
    try {
      const payload = {
        schedule_type: scheduleForm.schedule_type,
        interval_minutes: scheduleForm.schedule_type === 'interval' ? scheduleForm.interval_minutes : null,
        time_of_day: scheduleForm.schedule_type !== 'interval' ? scheduleForm.time_of_day : null,
        day_of_week: scheduleForm.schedule_type === 'weekly' ? scheduleForm.day_of_week : null,
        analysts: scheduleForm.analysts,
        max_debate_rounds: 1,
        max_risk_discuss_rounds: 1,
      }
      const { data } = await api.post<{ created: number; skipped?: string[] }>(
        '/api/schedules/bulk-from-holdings',
        payload,
      )
      const skipped = data.skipped?.length || 0
      setError(skipped
        ? t('holdings.schedule.createdMixed', { created: data.created, skipped })
        : t('holdings.schedule.createdNew', { n: data.created }))
      setScheduleOpen(false)
    } catch (err) {
      setError(`${t('holdings.schedule.createFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setScheduling(false)
    }
  }

  async function importHoldings() {
    setImporting(true)
    setError('')
    try {
      const { data } = await api.post<{ created: number; errors?: string[] }>('/api/holdings/import', {
        csv_text: csvText,
        asset_type: 'stock',
      })
      const skipped = data.errors?.length || 0
      setError(skipped
        ? t('holdings.csv.partialMsg', { created: data.created, skipped })
        : t('holdings.csv.okMsg', { n: data.created }))
      setCsvText('')
      setImportOpen(false)
      await load()
    } catch (err) {
      setError(`${t('holdings.csv.failed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('holdings.title')}
        subtitle={t('holdings.subtitle')}
        actions={
          <>
            <Button icon={CalendarPlus} disabled={!holdings.length} onClick={() => setScheduleOpen(true)}>
              {t('holdings.addToSchedule')}
            </Button>
            <Button icon={UploadSimple} onClick={() => setImportOpen(true)}>
              {t('holdings.importCsv')}
            </Button>
            <Button icon={Plus} onClick={openCreate}>
              {t('holdings.addHolding')}
            </Button>
          </>
        }
      />
      <ErrorBanner message={error} />

      {holdings.length ? (
        <div className="kumo-stat-grid">
          <Stat label={t('holdings.stat.count')} value={holdings.length} />
          <Stat label={t('holdings.stat.marketValue')} value={totalMarketValue.toFixed(2)} />
          <Stat label={t('holdings.stat.cumulativePnl')} value={signed(totalPnl)} positive={totalPnl >= 0} />
          <Stat label={t('holdings.stat.avgPnlPct')} value={`${avgPnlPct.toFixed(2)}%`} positive={avgPnlPct >= 0} />
        </div>
      ) : null}

      <SectionCard>
        {holdings.length ? (
          <KumoTable>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t('holdings.cols.ticker')}</Table.Head>
                <Table.Head>{t('holdings.cols.sharesCost')}</Table.Head>
                <Table.Head>{t('holdings.cols.last')}</Table.Head>
                <Table.Head>{t('holdings.cols.marketValue')}</Table.Head>
                <Table.Head>{t('holdings.cols.pnl')}</Table.Head>
                <Table.Head>{t('holdings.cols.latestSignal')}</Table.Head>
                <Table.Head>{t('holdings.cols.openDate')}</Table.Head>
                <Table.Head>{t('holdings.cols.notes')}</Table.Head>
                <Table.Head>{t('holdings.cols.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {holdings.map((holding) => {
                const quote = quotes[holding.id]
                const analysis = holding.latest_analysis
                return (
                  <Table.Row key={holding.id}>
                    <Table.Cell>{holding.ticker}</Table.Cell>
                    <Table.Cell>{holding.shares} x {holding.cost_price}</Table.Cell>
                    <Table.Cell>{quote?.last_price != null ? quote.last_price.toFixed(2) : '-'}</Table.Cell>
                    <Table.Cell>{quote?.market_value != null ? quote.market_value.toFixed(2) : '-'}</Table.Cell>
                    <Table.Cell>
                      {quote?.pnl_amount != null ? (
                        <span className={quote.pnl_amount >= 0 ? 'market-up' : 'market-down'}>
                          {signed(quote.pnl_amount)} ({quote.pnl_pct?.toFixed(2)}%)
                        </span>
                      ) : '-'}
                    </Table.Cell>
                    <Table.Cell>
                      {analysis ? (
                        <Link to={`/report/${analysis.id}`} className="kumo-link-reset">
                          <Badge variant={signalBadgeVariant(analysis.signal || undefined)}>
                            {analysis.signal || 'N/A'} · {analysis.trade_date}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge variant="secondary">-</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>{holding.open_date || '-'}</Table.Cell>
                    <Table.Cell>{holding.notes || '-'}</Table.Cell>
                    <Table.Cell>
                      <div className="kumo-row-actions">
                        <Button size="sm" icon={MagnifyingGlass} onClick={() => analyzeHolding(holding)}>{t('holdings.btn.analyze')}</Button>
                        <Button size="sm" icon={ChartLine} onClick={() => setKlineTicker(holding.ticker)}>
                          {t('holdings.btn.kline')}
                        </Button>
                        <Button size="sm" icon={PencilSimple} onClick={() => openEdit(holding)}>{t('holdings.btn.edit')}</Button>
                        <Button size="sm" icon={Trash} variant="secondary-destructive" onClick={() => deleteHolding(holding)}>
                          {t('holdings.btn.delete')}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </KumoTable>
        ) : (
          <LoadingEmpty loading={loading} title={t('holdings.empty')} />
        )}
      </SectionCard>

      <Dialog.Root open={editOpen} onOpenChange={setEditOpen}>
        <Dialog size="lg">
          <Dialog.Title>{editingId ? t('holdings.editTitle') : t('holdings.addTitle')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Input
              label={t('holdings.fields.ticker')}
              value={holdingForm.ticker}
              disabled={Boolean(editingId)}
              placeholder={t('holdings.fields.tickerPlaceholder')}
              onChange={(event) => updateHolding('ticker', event.currentTarget.value.toUpperCase())}
            />
            <Radio.Group
              legend={t('holdings.fields.assetType')}
              orientation="horizontal"
              value={holdingForm.asset_type}
              disabled={Boolean(editingId)}
              onValueChange={(value) => updateHolding('asset_type', value)}
            >
              <Radio.Item value="stock" label={t('common.stock')} />
              <Radio.Item value="crypto" label={t('common.crypto')} />
            </Radio.Group>
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('holdings.fields.shares')}
              value={holdingForm.shares}
              onChange={(event) => updateHolding('shares', Number(event.currentTarget.value))}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('holdings.fields.costPrice')}
              value={holdingForm.cost_price}
              onChange={(event) => updateHolding('cost_price', Number(event.currentTarget.value))}
            />
            <Input
              type="date"
              label={t('holdings.fields.openDate')}
              value={holdingForm.open_date}
              onChange={(event) => updateHolding('open_date', event.currentTarget.value)}
            />
            <Textarea
              label={t('holdings.fields.notes')}
              rows={3}
              value={holdingForm.notes}
              onChange={(event) => updateHolding('notes', event.currentTarget.value)}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={Check} loading={saving} onClick={saveHolding}>{t('common.save')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <Dialog size="lg">
          <Dialog.Title>{t('holdings.schedule.title')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Banner variant="secondary" title={t('holdings.schedule.info')} />
            <Radio.Group
              legend={t('holdings.schedule.type')}
              orientation="horizontal"
              value={scheduleForm.schedule_type}
              onValueChange={(value) => setScheduleForm((current) => ({ ...current, schedule_type: value as ScheduleForm['schedule_type'] }))}
            >
              <Radio.Item value="daily" label={t('holdings.schedule.daily')} />
              <Radio.Item value="weekly" label={t('holdings.schedule.weekly')} />
              <Radio.Item value="interval" label={t('holdings.schedule.interval')} />
            </Radio.Group>
            {scheduleForm.schedule_type === 'interval' ? (
              <Input
                type="number"
                min={5}
                step={5}
                label={t('holdings.schedule.intervalMinutes')}
                value={scheduleForm.interval_minutes}
                onChange={(event) => setScheduleForm((current) => ({ ...current, interval_minutes: Number(event.currentTarget.value) }))}
              />
            ) : (
              <Input
                type="time"
                label={t('holdings.schedule.timeOfDay')}
                value={scheduleForm.time_of_day}
                onChange={(event) => setScheduleForm((current) => ({ ...current, time_of_day: event.currentTarget.value }))}
              />
            )}
            {scheduleForm.schedule_type === 'weekly' ? (
              <Select
                label={t('holdings.schedule.dayOfWeek')}
                value={scheduleForm.day_of_week}
                items={dayItems}
                onValueChange={(value) => setScheduleForm((current) => ({ ...current, day_of_week: Number(value) }))}
              />
            ) : null}
            <Checkbox.Group
              legend={t('holdings.schedule.enableAnalysts')}
              value={scheduleForm.analysts}
              allValues={scheduleAnalysts}
              onValueChange={(value) => setScheduleForm((current) => ({ ...current, analysts: value }))}
            >
              <Checkbox.Item value="market" label={t('holdings.schedule.analystMarket')} />
              <Checkbox.Item value="news" label={t('holdings.schedule.analystNews')} />
              <Checkbox.Item value="fundamentals" label={t('holdings.schedule.analystFundamentals')} />
              <Checkbox.Item value="cn_social" label={t('holdings.schedule.analystCnSocial')} />
              <Checkbox.Item value="event" label={t('holdings.schedule.analystEvent')} />
            </Checkbox.Group>
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={CalendarPlus} loading={scheduling} onClick={bulkSchedule}>{t('holdings.schedule.createBtn')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog size="xl">
          <Dialog.Title>{t('holdings.csv.title')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Banner variant="secondary" title={t('holdings.csv.info')} />
            <Textarea
              label={t('holdings.csv.title')}
              rows={10}
              value={csvText}
              placeholder={t('holdings.csv.placeholder')}
              onChange={(event) => setCsvText(event.currentTarget.value)}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={UploadSimple} loading={importing} disabled={!csvText.trim()} onClick={importHoldings}>
              {t('holdings.csv.submit')}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={Boolean(klineTicker)} onOpenChange={(open) => {
        if (!open) setKlineTicker('')
      }}>
        <Dialog size="xl" className="kumo-kline-dialog">
          <Dialog.Title>{klineTicker ? t('holdings.klineTitle', { ticker: klineTicker }) : ''}</Dialog.Title>
          {klineTicker ? <KLineChart ticker={klineTicker} /> : null}
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function Stat({
  label,
  value,
  positive,
}: {
  label: string
  value: string | number
  positive?: boolean
}) {
  return (
    <SectionCard>
      <div className="kumo-stat">
        <span>{label}</span>
        <strong className={positive == null ? undefined : positive ? 'market-up' : 'market-down'}>
          {value}
        </strong>
      </div>
    </SectionCard>
  )
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}
