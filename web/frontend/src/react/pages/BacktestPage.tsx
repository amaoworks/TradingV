import {
  Badge,
  Banner,
  Button,
  Dialog,
  Input,
  Radio,
  Select,
  Table,
  Tabs,
} from '@cloudflare/kumo'
import type { BadgeVariant } from '@cloudflare/kumo'
import { ChartLine, Play, Plus, Trash, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage } from '../lib/format'

type SizingMode = 'equal_weight' | 'fixed_cash' | 'signal_strength'

interface BacktestMetrics {
  total_return_pct?: number | null
  annualised_return_pct?: number | null
  benchmark_return_pct?: number | null
  alpha_pct?: number | null
  max_drawdown_pct?: number | null
  sharpe?: number | null
  sortino?: number | null
  win_rate_pct?: number | null
  n_round_trips?: number | null
  profit_factor?: number | null
  avg_win_pct?: number | null
  avg_loss_pct?: number | null
}

interface BacktestRun {
  id: number
  name: string
  signal_source: string
  tickers: string | null
  benchmark: string | null
  start_date: string
  end_date: string
  initial_cash: number
  status: string
  final_total: number | null
  metrics: BacktestMetrics | null
  warnings?: string | null
  error_msg?: string | null
  created_at: string
  completed_at: string | null
}

interface BacktestSource {
  key: string
  label: string
  tagline: string
  description: string
  available: boolean
}

interface UniverseResponse {
  tickers?: string[]
  min_date?: string | null
  max_date?: string | null
}

interface CurveRow {
  snapshot_date: string
  total_value: number
  benchmark_value?: number | null
}

interface TradeRow {
  id?: number
  timestamp: string
  ticker: string
  action: 'buy' | 'sell' | string
  shares: number
  price: number
  fee: number
  realised_pnl?: number | null
  source_analysis_id?: string | null
}

interface CreateForm {
  name: string
  startDate: string
  endDate: string
  signalSource: string
  tickersText: string
  benchmark: string
  initialCash: number
  sizingMode: SizingMode
  fixedCashPerSignal: string
  confidenceFloorPct: number
}

export function BacktestPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState('list')
  const [runs, setRuns] = useState<BacktestRun[]>([])
  const [sources, setSources] = useState<BacktestSource[]>([])
  const [availableTickers, setAvailableTickers] = useState<string[]>([])
  const [dateBounds, setDateBounds] = useState<{ min: string | null; max: string | null }>({ min: null, max: null })
  const [activeRunId, setActiveRunId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>({
    name: '',
    startDate: '',
    endDate: '',
    signalSource: 'memory_log',
    tickersText: '',
    benchmark: '000300.SH',
    initialCash: 1_000_000,
    sizingMode: 'equal_weight',
    fixedCashPerSignal: '',
    confidenceFloorPct: 0,
  })

  const activeRun = runs.find((run) => run.id === activeRunId) || null

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items?: BacktestRun[] }>('/api/backtest')
      setRuns(data.items || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadMetadata = useCallback(async () => {
    try {
      const [sourcesRes, universeRes] = await Promise.all([
        api.get<{ items?: BacktestSource[] }>('/api/backtest/sources'),
        api.get<UniverseResponse>('/api/backtest/universe'),
      ])
      setSources(sourcesRes.data.items || [])
      setAvailableTickers(universeRes.data.tickers || [])
      setDateBounds({
        min: universeRes.data.min_date || null,
        max: universeRes.data.max_date || null,
      })
      setForm((current) => ({
        ...current,
        startDate: current.startDate || universeRes.data.min_date || '',
        endDate: current.endDate || universeRes.data.max_date || '',
      }))
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    }
  }, [t])

  useEffect(() => {
    loadRuns()
    loadMetadata()
  }, [loadRuns, loadMetadata])

  function update<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openDetail(run: BacktestRun) {
    setActiveRunId(run.id)
    setTab('detail')
  }

  async function runBacktest() {
    if (!form.startDate || !form.endDate) {
      setError(t('backtest.validation.dateRange'))
      return
    }
    setRunning(true)
    setError('')
    setNotice('')
    try {
      const tickers = parseTickers(form.tickersText)
      const payload = {
        name: form.name || null,
        signal_source: form.signalSource,
        source_config: {},
        tickers: tickers.length ? tickers : null,
        benchmark: form.benchmark || null,
        start_date: form.startDate,
        end_date: form.endDate,
        initial_cash: form.initialCash,
        sizing_mode: form.sizingMode,
        fixed_cash_per_signal: form.fixedCashPerSignal ? Number(form.fixedCashPerSignal) : null,
        confidence_floor: form.confidenceFloorPct > 0 ? form.confidenceFloorPct / 100 : null,
      }
      const { data } = await api.post<BacktestRun>('/api/backtest', payload)
      setNotice(t('backtest.msg.done'))
      setCreateOpen(false)
      await loadRuns()
      setActiveRunId(data.id)
      setTab('detail')
    } catch (err) {
      setError(`${t('backtest.msg.failed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setRunning(false)
    }
  }

  async function deleteRun(run: BacktestRun) {
    if (!window.confirm(t('backtest.confirmDeleteContent', { name: run.name }))) return
    setError('')
    try {
      await api.delete(`/api/backtest/${run.id}`)
      setNotice(t('common.deleted'))
      if (activeRunId === run.id) {
        setActiveRunId(null)
        setTab('list')
      }
      await loadRuns()
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    }
  }

  const sourceItems = useMemo(
    () => sources
      .filter((source) => source.available)
      .map((source) => ({ label: sourceLabel(source.key, t), value: source.key })),
    [sources, t],
  )

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('backtest.title')}
        subtitle={t('backtest.subtitle')}
        actions={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            {t('backtest.newBtn')}
          </Button>
        }
      />

      <SectionCard title={t('backtest.intro.header')}>
        <div className="kumo-backtest-intro">
          <p><strong>{t('backtest.intro.principleLabel')}</strong>{t('backtest.intro.principle')}</p>
          <p>
            <strong>{t('backtest.intro.whyLabel')}</strong>{t('backtest.intro.why')}{' '}
            <strong>{t('backtest.intro.whyEmph')}</strong>{t('backtest.intro.whySuffix')}
          </p>
          <p>
            <strong>{t('backtest.intro.howLabel')}</strong>{t('backtest.intro.how')}{' '}
            <strong>{t('backtest.intro.holdEmph')}</strong>{t('backtest.intro.howSuffix')}
          </p>
          <div className="kumo-backtest-source-grid">
            <SourceCard badge={t('backtest.intro.cards.liveBadge')} title={t('backtest.intro.cards.liveTitle')} description={t('backtest.intro.cards.liveDesc')} variant="success" />
            <SourceCard badge={t('backtest.intro.cards.planBadge')} title={t('backtest.intro.cards.planTitle')} description={t('backtest.intro.cards.planDesc')} variant="warning" />
            <SourceCard badge={t('backtest.intro.cards.rerunBadge')} title={t('backtest.intro.cards.rerunTitle')} description={t('backtest.intro.cards.rerunDesc')} variant="secondary" />
          </div>
        </div>
      </SectionCard>

      <Banner variant="secondary" title={t('backtest.disclaimer')} />
      <ErrorBanner message={error} />
      {notice ? <Banner variant="default" title={notice} /> : null}

      <SectionCard>
        <div className="kumo-tabs-wrap">
          <Tabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'list', label: t('backtest.tabs.list') },
              ...(activeRun ? [{ value: 'detail', label: t('backtest.tabs.detail', { name: activeRun.name }) }] : []),
            ]}
          />
        </div>
        {tab === 'list' ? (
          runs.length ? (
            <RunsTable runs={runs} t={t} onView={openDetail} onDelete={deleteRun} />
          ) : (
            <LoadingEmpty loading={loading} title={t('backtest.empty')} />
          )
        ) : null}
        {tab === 'detail' && activeRun ? (
          <BacktestDetail runId={activeRun.id} listRun={activeRun} />
        ) : null}
      </SectionCard>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog size="lg">
          <Dialog.Title>{t('backtest.createTitle')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Input
              label={t('backtest.fields.name')}
              value={form.name}
              placeholder={t('backtest.fields.namePlaceholder')}
              onChange={(event) => update('name', event.currentTarget.value)}
            />
            <div className="kumo-form-grid compact">
              <Input
                type="date"
                label={t('backtest.fields.startDate')}
                value={form.startDate}
                min={dateBounds.min || undefined}
                max={form.endDate || dateBounds.max || undefined}
                onChange={(event) => update('startDate', event.currentTarget.value)}
              />
              <Input
                type="date"
                label={t('backtest.fields.endDate')}
                value={form.endDate}
                min={form.startDate || dateBounds.min || undefined}
                max={dateBounds.max || undefined}
                onChange={(event) => update('endDate', event.currentTarget.value)}
              />
            </div>
            <Select
              label={t('backtest.fields.source')}
              value={form.signalSource}
              items={sourceItems}
              loading={!sources.length}
              onValueChange={(value) => update('signalSource', String(value || 'memory_log'))}
            />
            <Input
              label={t('backtest.fields.universe')}
              value={form.tickersText}
              placeholder={t('backtest.fields.universePlaceholder')}
              description={availableTickers.length ? availableTickers.slice(0, 12).join(', ') : undefined}
              onChange={(event) => update('tickersText', event.currentTarget.value.toUpperCase())}
            />
            <div className="kumo-form-grid compact">
              <Input
                label={t('backtest.fields.benchmark')}
                value={form.benchmark}
                placeholder={t('backtest.fields.benchmarkPlaceholder')}
                onChange={(event) => update('benchmark', event.currentTarget.value.toUpperCase())}
              />
              <Input
                type="number"
                min={10000}
                step={10000}
                label={t('backtest.fields.initialCash')}
                value={form.initialCash}
                onChange={(event) => update('initialCash', Number(event.currentTarget.value))}
              />
            </div>
            <Radio.Group
              legend={t('backtest.fields.sizingMode')}
              orientation="horizontal"
              value={form.sizingMode}
              onValueChange={(value) => update('sizingMode', value as SizingMode)}
            >
              <Radio.Item value="equal_weight" label={t('backtest.fields.equalWeight')} />
              <Radio.Item value="fixed_cash" label={t('backtest.fields.fixedCash')} />
              <Radio.Item value="signal_strength" label={t('backtest.fields.signalStrength')} />
            </Radio.Group>
            {form.sizingMode !== 'equal_weight' ? (
              <Input
                type="number"
                min={0}
                step={10000}
                label={t('backtest.fields.fixedCashPerSignal')}
                value={form.fixedCashPerSignal}
                placeholder={t('backtest.fields.fixedCashPlaceholder')}
                onChange={(event) => update('fixedCashPerSignal', event.currentTarget.value)}
              />
            ) : null}
            <Input
              type="range"
              min={0}
              max={100}
              step={5}
              label={`${t('backtest.fields.confidenceFloor')}: ${confidenceLabel(form.confidenceFloorPct, t)}`}
              value={form.confidenceFloorPct}
              onChange={(event) => update('confidenceFloorPct', Number(event.currentTarget.value))}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={Play} loading={running} onClick={runBacktest}>{t('backtest.btn.run')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function BacktestDetail({ runId, listRun }: { runId: number; listRun: BacktestRun }) {
  const { t } = useI18n()
  const [run, setRun] = useState<BacktestRun>(listRun)
  const [curve, setCurve] = useState<CurveRow[]>([])
  const [trades, setTrades] = useState<TradeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [runRes, curveRes, tradesRes] = await Promise.all([
        api.get<BacktestRun>(`/api/backtest/${runId}`),
        api.get<{ items?: CurveRow[] }>(`/api/backtest/${runId}/curve`),
        api.get<{ items?: TradeRow[] }>(`/api/backtest/${runId}/trades`),
      ])
      setRun(runRes.data)
      setCurve(curveRes.data.items || [])
      setTrades(tradesRes.data.items || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [runId, t])

  useEffect(() => {
    load()
  }, [load])

  const metrics = run.metrics || {}

  return (
    <div className="kumo-backtest-detail">
      <ErrorBanner message={error} />
      <div className="kumo-stat-grid backtest">
        <Stat label={t('backtestDetail.metrics.totalReturn')} value={formatPct(metrics.total_return_pct)} positive={(metrics.total_return_pct || 0) >= 0} />
        <Stat label={t('backtestDetail.metrics.annualised')} value={formatPct(metrics.annualised_return_pct)} positive={(metrics.annualised_return_pct || 0) >= 0} />
        <Stat
          label={t('backtestDetail.metrics.vsBench')}
          value={formatPct(metrics.alpha_pct)}
          helper={`${run.benchmark || '-'} · ${t('backtestDetail.metrics.benchSuffix', { v: formatPct(metrics.benchmark_return_pct) })}`}
          positive={(metrics.alpha_pct || 0) >= 0}
        />
        <Stat label={t('backtestDetail.metrics.mdd')} value={formatDrawdown(metrics.max_drawdown_pct)} positive={false} />
        <Stat label={t('backtestDetail.metrics.sharpe')} value={formatNumber(metrics.sharpe)} />
        <Stat label={t('backtestDetail.metrics.sortino')} value={formatNumber(metrics.sortino)} />
        <Stat
          label={t('backtestDetail.metrics.winRate')}
          value={metrics.win_rate_pct != null ? `${metrics.win_rate_pct.toFixed(0)}%` : '-'}
          helper={t('backtestDetail.metrics.roundTrips', { n: metrics.n_round_trips || 0 })}
        />
        <Stat
          label={t('backtestDetail.metrics.profitFactor')}
          value={formatProfitFactor(metrics.profit_factor)}
          helper={t('backtestDetail.metrics.avgWinLoss', {
            win: formatPct(metrics.avg_win_pct),
            loss: formatPct(metrics.avg_loss_pct),
          })}
        />
      </div>

      <SectionCard title={t('backtestDetail.navTitle')}>
        {curve.length ? (
          <div className="kumo-chart-panel">
            <BacktestNavChart rows={curve} initialCash={run.initial_cash} benchmark={run.benchmark} />
          </div>
        ) : (
          <LoadingEmpty loading={loading} title={t('backtestDetail.navEmpty')} />
        )}
      </SectionCard>

      <SectionCard title={t('backtestDetail.tradesTitle')}>
        {!trades.length && run.metrics ? (
          <Banner
            variant="alert"
            title={`${t('backtestDetail.noTradesAlert')} ${t('backtestDetail.noTradesAlertEmph')} ${t('backtestDetail.noTradesAlertSuffix')}`}
            description={[
              t('backtestDetail.noTradesReasons.r1'),
              t('backtestDetail.noTradesReasons.r2'),
              t('backtestDetail.noTradesReasons.r3'),
            ].join(' ')}
          />
        ) : null}
        {trades.length ? <TradesTable trades={trades} t={t} /> : null}
      </SectionCard>

      {run.warnings ? (
        <SectionCard title={t('backtestDetail.warningsTitle')}>
          <pre className="kumo-warning-pre">{run.warnings}</pre>
        </SectionCard>
      ) : null}
    </div>
  )
}

function RunsTable({
  runs,
  t,
  onView,
  onDelete,
}: {
  runs: BacktestRun[]
  t: (key: string, params?: Record<string, string | number>) => string
  onView: (run: BacktestRun) => void
  onDelete: (run: BacktestRun) => void
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Cell>{t('backtest.cols.name')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.source')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.range')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.status')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.totalReturn')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.benchmark')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.mdd')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.sharpe')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.winRate')}</Table.Cell>
          <Table.Cell>{t('backtest.cols.actions')}</Table.Cell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {runs.map((run) => (
          <Table.Row key={run.id}>
            <Table.Cell>{run.name}</Table.Cell>
            <Table.Cell>{sourceLabel(run.signal_source, t)}</Table.Cell>
            <Table.Cell>{run.start_date} - {run.end_date}</Table.Cell>
            <Table.Cell>
              <Badge variant={statusVariant(run.status)}>{statusLabel(run.status, t)}</Badge>
            </Table.Cell>
            <Table.Cell>
              <span className={marketClass(run.metrics?.total_return_pct)}>
                {formatPct(run.metrics?.total_return_pct)}
              </span>
            </Table.Cell>
            <Table.Cell>{formatPct(run.metrics?.benchmark_return_pct)}</Table.Cell>
            <Table.Cell>{formatDrawdown(run.metrics?.max_drawdown_pct)}</Table.Cell>
            <Table.Cell>{formatNumber(run.metrics?.sharpe)}</Table.Cell>
            <Table.Cell>{run.metrics?.win_rate_pct != null ? `${run.metrics.win_rate_pct.toFixed(0)}%` : '-'}</Table.Cell>
            <Table.Cell>
              <div className="kumo-row-actions">
                <Button size="sm" icon={ChartLine} onClick={() => onView(run)}>
                  {t('backtest.btn.view')}
                </Button>
                <Button size="sm" icon={Trash} variant="secondary" onClick={() => onDelete(run)}>
                  {t('backtest.btn.delete')}
                </Button>
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function TradesTable({
  trades,
  t,
}: {
  trades: TradeRow[]
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Cell>{t('backtestDetail.cols.date')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.ticker')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.action')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.shares')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.price')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.fee')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.realisedPnl')}</Table.Cell>
          <Table.Cell>{t('backtestDetail.cols.relatedAnalysis')}</Table.Cell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {trades.map((trade, index) => (
          <Table.Row key={`${trade.timestamp}-${trade.ticker}-${index}`}>
            <Table.Cell>{trade.timestamp.slice(0, 10)}</Table.Cell>
            <Table.Cell>{trade.ticker}</Table.Cell>
            <Table.Cell>
              <Badge variant={trade.action === 'buy' ? 'success' : 'error'}>
                {trade.action === 'buy' ? t('backtestDetail.actions.buy') : t('backtestDetail.actions.sell')}
              </Badge>
            </Table.Cell>
            <Table.Cell>{trade.shares.toFixed(0)}</Table.Cell>
            <Table.Cell>{trade.price.toFixed(2)}</Table.Cell>
            <Table.Cell>{trade.fee.toFixed(2)}</Table.Cell>
            <Table.Cell>
              {trade.action === 'sell' ? (
                <span className={marketClass(trade.realised_pnl)}>
                  {formatMoney(trade.realised_pnl)}
                </span>
              ) : '-'}
            </Table.Cell>
            <Table.Cell>
              {trade.source_analysis_id ? (
                <Link to={`/report/${trade.source_analysis_id}`} className="kumo-link-reset">
                  <Badge variant="info">{trade.source_analysis_id.slice(0, 8)}</Badge>
                </Link>
              ) : '-'}
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function BacktestNavChart({
  rows,
  initialCash,
  benchmark,
}: {
  rows: CurveRow[]
  initialCash: number
  benchmark: string | null
}) {
  const width = 760
  const height = 280
  const padding = 30
  const strategyValues = rows.map((row) => row.total_value)
  const benchmarkValues = rows
    .map((row) => row.benchmark_value)
    .filter((value): value is number => value != null)
  const allValues = [...strategyValues, ...benchmarkValues, initialCash]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const span = max - min || 1

  const pointsFor = (values: number[]) => values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / span) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const strategyPoints = pointsFor(strategyValues)
  const benchmarkPoints = benchmarkValues.length === rows.length ? pointsFor(benchmarkValues) : ''
  const initialY = height - padding - ((initialCash - min) / span) * (height - padding * 2)

  return (
    <div className="kumo-backtest-chart-wrap">
      <svg className="kumo-nav-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1={padding} x2={width - padding} y1={initialY} y2={initialY} className="baseline" />
        {benchmarkPoints ? <polyline points={benchmarkPoints} className="benchmark-line" /> : null}
        <polyline points={strategyPoints} className="nav-line" />
        <text x={padding} y={18}>{max.toFixed(0)}</text>
        <text x={padding} y={height - 6}>{min.toFixed(0)}</text>
      </svg>
      <div className="kumo-chart-legend">
        <span><i className="strategy" />Strategy NAV</span>
        {benchmarkPoints ? <span><i className="benchmark" />{benchmark || 'Benchmark'}</span> : null}
      </div>
    </div>
  )
}

function SourceCard({
  badge,
  title,
  description,
  variant,
}: {
  badge: string
  title: string
  description: string
  variant: BadgeVariant
}) {
  return (
    <div className="kumo-backtest-source-card">
      <Badge variant={variant}>{badge}</Badge>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  helper,
  positive,
}: {
  label: string
  value: string
  helper?: string
  positive?: boolean
}) {
  return (
    <div className="kumo-stat">
      <span>{label}</span>
      <strong className={positive == null ? undefined : positive ? 'market-up' : 'market-down'}>
        {value}
      </strong>
      {helper ? <small className="kumo-cell-subtext">{helper}</small> : null}
    </div>
  )
}

function sourceLabel(key: string, t: (key: string) => string) {
  if (key === 'memory_log') return t('backtest.sources.memoryLog')
  if (key === 'rule') return t('backtest.sources.rule')
  if (key === 'live_agent') return t('backtest.sources.liveAgent')
  return key
}

function statusLabel(status: string, t: (key: string) => string) {
  if (status === 'complete') return t('backtest.statusMap.complete')
  if (status === 'running') return t('backtest.statusMap.running')
  if (status === 'pending') return t('backtest.statusMap.pending')
  if (status === 'failed') return t('backtest.statusMap.failed')
  return status
}

function statusVariant(status: string): BadgeVariant {
  if (status === 'complete') return 'success'
  if (status === 'running') return 'info'
  if (status === 'pending') return 'warning'
  if (status === 'failed') return 'error'
  return 'secondary'
}

function confidenceLabel(value: number, t: (key: string) => string) {
  if (value <= 0) return t('backtest.fields.confidenceMarks.none')
  return `>= ${(value / 100).toFixed(2)}`
}

function parseTickers(value: string) {
  return value
    .split(/[\s,，;；]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
}

function formatPct(value?: number | null) {
  if (value == null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatDrawdown(value?: number | null) {
  if (value == null) return '-'
  return `-${Math.abs(value).toFixed(2)}%`
}

function formatNumber(value?: number | null) {
  if (value == null) return '-'
  return value.toFixed(2)
}

function formatMoney(value?: number | null) {
  if (value == null) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function formatProfitFactor(value?: number | null) {
  if (value == null) return '-'
  return Number.isFinite(value) ? value.toFixed(2) : '∞'
}

function marketClass(value?: number | null) {
  if (value == null) return undefined
  return value >= 0 ? 'market-up' : 'market-down'
}
