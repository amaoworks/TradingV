import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Input,
  Radio,
  Select,
  Table,
} from '@cloudflare/kumo'
import { ArrowsClockwise, Eye } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage, signalBadgeVariant } from '../lib/format'

type Horizon = 5 | 30 | 60
type Dimension = 'ticker' | 'signal' | 'analyst' | 'analyst_combo' | 'llm'

interface QualitySummary {
  total: number
  evaluable: number
  directional: number
  win_rate: number | null
  avg_raw_return: number | null
  avg_alpha: number | null
  median_alpha: number | null
  best_alpha: number | null
  worst_alpha: number | null
  alpha_sharpe: number | null
}

interface SignalMixRow {
  signal: string
  count: number
  avg_alpha: number | null
}

interface OverviewResponse {
  horizon: Horizon
  summary: QualitySummary
  signal_mix: SignalMixRow[]
}

interface CalibrationBucket {
  bucket: string
  lo: number
  hi: number
  count: number
  win_rate: number | null
  avg_alpha: number | null
}

interface CalibrationResponse {
  horizon: Horizon
  buckets: CalibrationBucket[]
}

interface DimensionRow extends QualitySummary {
  key: string
}

interface DimensionResponse {
  dim: Dimension
  horizon: Horizon
  items: DimensionRow[]
}

interface HeatmapDay {
  date: string
  count: number
  avg_alpha: number | null
}

interface HeatmapResponse {
  horizon: Horizon
  days: HeatmapDay[]
}

interface DecisionRow {
  id: string
  ticker: string
  trade_date: string
  signal: string | null
  confidence: number | null
  analysts: string[]
  llm_provider: string | null
  deep_think_llm: string | null
  raw_return: number | null
  bench_return: number | null
  alpha: number | null
  evaluable: boolean
  win: boolean | null
  created_at: string
}

const signalItems = [
  { label: 'BUY', value: 'BUY' },
  { label: 'OVERWEIGHT', value: 'OVERWEIGHT' },
  { label: 'HOLD', value: 'HOLD' },
  { label: 'UNDERWEIGHT', value: 'UNDERWEIGHT' },
  { label: 'SELL', value: 'SELL' },
]

export function QualityPage() {
  const { t } = useI18n()
  const [horizon, setHorizon] = useState<Horizon>(30)
  const [dimension, setDimension] = useState<Dimension>('ticker')
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null)
  const [dimensionRows, setDimensionRows] = useState<DimensionRow[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null)
  const [decisions, setDecisions] = useState<DecisionRow[]>([])
  const [filterTicker, setFilterTicker] = useState('')
  const [filterSignal, setFilterSignal] = useState('')
  const [onlyEvaluable, setOnlyEvaluable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadDimension = useCallback(async (nextDimension = dimension, nextHorizon = horizon) => {
    const { data } = await api.get<DimensionResponse>('/api/quality/by-dimension', {
      params: { horizon: nextHorizon, dim: nextDimension, min_count: 1 },
    })
    setDimensionRows(data.items || [])
  }, [dimension, horizon])

  const loadAll = useCallback(async (nextHorizon = horizon) => {
    setLoading(true)
    setError('')
    try {
      const [overviewRes, calibrationRes, heatmapRes, decisionsRes, dimensionRes] = await Promise.all([
        api.get<OverviewResponse>('/api/quality/overview', { params: { horizon: nextHorizon } }),
        api.get<CalibrationResponse>('/api/quality/calibration', { params: { horizon: nextHorizon } }),
        api.get<HeatmapResponse>('/api/quality/heatmap', { params: { horizon: nextHorizon } }),
        api.get<{ items?: DecisionRow[] }>('/api/quality/decisions', { params: { horizon: nextHorizon, limit: 1000 } }),
        api.get<DimensionResponse>('/api/quality/by-dimension', {
          params: { horizon: nextHorizon, dim: dimension, min_count: 1 },
        }),
      ])
      setOverview(overviewRes.data)
      setCalibration(calibrationRes.data)
      setHeatmap(heatmapRes.data)
      setDecisions(decisionsRes.data.items || [])
      setDimensionRows(dimensionRes.data.items || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [dimension, horizon, t])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function changeHorizon(value: Horizon) {
    setHorizon(value)
    await loadAll(value)
  }

  async function changeDimension(value: Dimension) {
    setDimension(value)
    setError('')
    try {
      await loadDimension(value, horizon)
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    }
  }

  const filteredDecisions = useMemo(() => {
    let rows = decisions
    if (filterTicker.trim()) {
      const query = filterTicker.trim().toUpperCase()
      rows = rows.filter((row) => row.ticker.toUpperCase().includes(query))
    }
    if (filterSignal) {
      rows = rows.filter((row) => (row.signal || '').toUpperCase() === filterSignal)
    }
    if (onlyEvaluable) {
      rows = rows.filter((row) => row.evaluable)
    }
    return rows
  }, [decisions, filterSignal, filterTicker, onlyEvaluable])

  const signalCountSummary = overview?.signal_mix
    ?.map((row) => `${row.signal} ${row.count}`)
    .join(' · ') || '-'
  const signalAlphaSummary = overview?.signal_mix
    ?.filter((row) => row.avg_alpha != null)
    .map((row) => `${row.signal} alpha=${formatPct(row.avg_alpha)}`)
    .join(' · ') || ''

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('quality.title')}
        subtitle={t('quality.subtitle')}
        actions={
          <div className="kumo-page-actions">
            <Radio.Group
              legend="Horizon"
              orientation="horizontal"
              value={String(horizon)}
              className="kumo-compact-radio"
              onValueChange={(value) => changeHorizon(Number(value) as Horizon)}
            >
              <Radio.Item value="5" label={t('quality.horizon.d5')} />
              <Radio.Item value="30" label={t('quality.horizon.d30')} />
              <Radio.Item value="60" label={t('quality.horizon.d60')} />
            </Radio.Group>
            <Button icon={ArrowsClockwise} variant="secondary" loading={loading} onClick={() => loadAll()}>
              {t('common.refresh')}
            </Button>
          </div>
        }
      />

      <SectionCard title={t('quality.intro.header')}>
        <div className="kumo-backtest-intro">
          <p><strong>{t('quality.intro.whatLabel')}</strong>{t('quality.intro.what')}</p>
          <p><strong>{t('quality.intro.howLabel')}</strong>{t('quality.intro.how')}</p>
          <p>{t('quality.intro.benchHint')}</p>
        </div>
      </SectionCard>

      <ErrorBanner message={error} />

      {overview && overview.summary.total === 0 ? (
        <Banner variant="secondary" title={t('quality.empty')} />
      ) : null}

      {overview && overview.summary.total > 0 ? (
        <>
          <div className="kumo-stat-grid backtest">
            <Stat label={t('quality.kpi.totalDecisions')} value={String(overview.summary.total)} helper={t('quality.kpi.evaluableSuffix', { n: overview.summary.evaluable })} />
            <Stat label={t('quality.kpi.winRate')} value={formatRate(overview.summary.win_rate)} helper={t('quality.kpi.directionalSuffix', { n: overview.summary.directional })} positive={(overview.summary.win_rate || 0) >= 0.5} />
            <Stat label={t('quality.kpi.avgAlpha')} value={formatPct(overview.summary.avg_alpha)} helper={t('quality.kpi.medianSuffix', { v: formatPct(overview.summary.median_alpha) })} positive={(overview.summary.avg_alpha || 0) >= 0} />
            <Stat label={t('quality.kpi.alphaSharpe')} value={formatNumber(overview.summary.alpha_sharpe)} helper={t('quality.kpi.sharpeHint')} />
            <Stat label={t('quality.kpi.avgRaw')} value={formatPct(overview.summary.avg_raw_return)} positive={(overview.summary.avg_raw_return || 0) >= 0} />
            <Stat label={t('quality.kpi.bestAlpha')} value={formatPct(overview.summary.best_alpha)} positive={(overview.summary.best_alpha || 0) >= 0} />
            <Stat label={t('quality.kpi.worstAlpha')} value={formatPct(overview.summary.worst_alpha)} positive={(overview.summary.worst_alpha || 0) >= 0} />
            <Stat label={t('quality.kpi.signalCount')} value={signalCountSummary} helper={signalAlphaSummary} />
          </div>

          <SectionCard title={t('quality.calibration.title')}>
            <div className="kumo-two-column quality">
              <div>
                <p className="kumo-muted-text quality-hint">{t('quality.calibration.hint')}</p>
                {calibration?.buckets?.some((bucket) => bucket.count > 0) ? (
                  <CalibrationChart buckets={calibration.buckets} />
                ) : (
                  <LoadingEmpty loading={loading} title={t('quality.dim.empty')} />
                )}
              </div>
              <CalibrationTable buckets={calibration?.buckets || []} t={t} />
            </div>
          </SectionCard>

          <SectionCard title={t('quality.dim.title')}>
            <div className="kumo-strategy-row">
              <Radio.Group
                legend={t('quality.dim.title')}
                orientation="horizontal"
                className="kumo-compact-radio"
                value={dimension}
                onValueChange={(value) => changeDimension(value as Dimension)}
              >
                <Radio.Item value="ticker" label={t('quality.dim.ticker')} />
                <Radio.Item value="signal" label={t('quality.dim.signal')} />
                <Radio.Item value="analyst" label={t('quality.dim.analyst')} />
                <Radio.Item value="analyst_combo" label={t('quality.dim.combo')} />
                <Radio.Item value="llm" label={t('quality.dim.llm')} />
              </Radio.Group>
            </div>
            {dimensionRows.length ? (
              <DimensionTable rows={dimensionRows} t={t} />
            ) : (
              <LoadingEmpty loading={loading} title={t('quality.dim.empty')} />
            )}
          </SectionCard>

          {heatmap?.days?.length ? (
            <SectionCard title={t('quality.heatmap.title')}>
              <div className="kumo-quality-heatmap">
                <p className="kumo-muted-text">{t('quality.heatmap.hint')}</p>
                <div className="quality-heatmap-grid">
                  {heatmap.days.map((day) => (
                    <div
                      key={day.date}
                      className="quality-heatmap-cell"
                      style={{ background: alphaToColor(day.avg_alpha) }}
                      title={`${day.date} · ${day.count} ${t('quality.heatmap.cellCount')} · alpha=${formatPct(day.avg_alpha)}`}
                    />
                  ))}
                </div>
                <div className="quality-heatmap-legend">
                  <span>{t('quality.heatmap.legendNeg')}</span>
                  <div>
                    {[-0.1, -0.05, 0, 0.05, 0.1].map((value) => (
                      <i key={value} style={{ background: alphaToColor(value) }} />
                    ))}
                  </div>
                  <span>{t('quality.heatmap.legendPos')}</span>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title={t('quality.decisions.title')}>
            <div className="kumo-filter-row quality">
              <Input
                label={t('quality.decisions.filterTicker')}
                value={filterTicker}
                onChange={(event) => setFilterTicker(event.currentTarget.value.toUpperCase())}
              />
              <Select
                label={t('quality.decisions.filterSignal')}
                value={filterSignal}
                items={signalItems}
                onValueChange={(value) => setFilterSignal(String(value || ''))}
              />
              <Checkbox
                label={t('quality.decisions.onlyEvaluable')}
                checked={onlyEvaluable}
                onCheckedChange={(checked) => setOnlyEvaluable(Boolean(checked))}
              />
            </div>
            {filteredDecisions.length ? (
              <DecisionTable rows={filteredDecisions} t={t} />
            ) : (
              <LoadingEmpty loading={loading} title={t('quality.dim.empty')} />
            )}
          </SectionCard>
        </>
      ) : !overview ? (
        <SectionCard>
          <LoadingEmpty loading={loading} title={t('quality.empty')} />
        </SectionCard>
      ) : null}
    </div>
  )
}

function CalibrationChart({ buckets }: { buckets: CalibrationBucket[] }) {
  const width = 520
  const height = 220
  const pad = 28
  const barWidth = (width - pad * 2) / Math.max(1, buckets.length)
  return (
    <svg className="quality-calibration-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className="axis" />
      <line x1={pad} x2={pad} y1={pad} y2={height - pad} className="axis" />
      {buckets.map((bucket, index) => {
        const actual = bucket.win_rate == null ? 0 : bucket.win_rate
        const ideal = (bucket.lo + bucket.hi) / 2
        const x = pad + index * barWidth + 8
        const actualHeight = actual * (height - pad * 2)
        const idealHeight = ideal * (height - pad * 2)
        return (
          <g key={bucket.bucket}>
            <rect
              x={x}
              y={height - pad - idealHeight}
              width={barWidth - 16}
              height={idealHeight}
              className="ideal"
            />
            <rect
              x={x + 4}
              y={height - pad - actualHeight}
              width={barWidth - 24}
              height={actualHeight}
              className="actual"
            />
            <text x={x} y={height - 8}>{bucket.bucket}</text>
          </g>
        )
      })}
      <text x={pad} y={16}>100%</text>
    </svg>
  )
}

function CalibrationTable({
  buckets,
  t,
}: {
  buckets: CalibrationBucket[]
  t: (key: string) => string
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Cell>{t('quality.calibration.cols.bucket')}</Table.Cell>
          <Table.Cell>{t('quality.calibration.cols.count')}</Table.Cell>
          <Table.Cell>{t('quality.calibration.cols.winRate')}</Table.Cell>
          <Table.Cell>{t('quality.calibration.cols.avgAlpha')}</Table.Cell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {buckets.map((bucket) => (
          <Table.Row key={bucket.bucket}>
            <Table.Cell>{bucket.bucket}</Table.Cell>
            <Table.Cell>{bucket.count}</Table.Cell>
            <Table.Cell>{formatRate(bucket.win_rate)}</Table.Cell>
            <Table.Cell>
              <span className={marketClass(bucket.avg_alpha)}>{formatPct(bucket.avg_alpha)}</span>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function DimensionTable({
  rows,
  t,
}: {
  rows: DimensionRow[]
  t: (key: string) => string
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Cell>{t('quality.dim.cols.key')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.total')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.evaluable')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.directional')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.winRate')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.avgAlpha')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.medianAlpha')}</Table.Cell>
          <Table.Cell>{t('quality.dim.cols.sharpe')}</Table.Cell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.key}>
            <Table.Cell>{row.key}</Table.Cell>
            <Table.Cell>{row.total}</Table.Cell>
            <Table.Cell>{row.evaluable}</Table.Cell>
            <Table.Cell>{row.directional}</Table.Cell>
            <Table.Cell>
              <span className={winRateClass(row.win_rate)}>{formatRate(row.win_rate)}</span>
            </Table.Cell>
            <Table.Cell><span className={marketClass(row.avg_alpha)}>{formatPct(row.avg_alpha)}</span></Table.Cell>
            <Table.Cell><span className={marketClass(row.median_alpha)}>{formatPct(row.median_alpha)}</span></Table.Cell>
            <Table.Cell>{formatNumber(row.alpha_sharpe)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function DecisionTable({
  rows,
  t,
}: {
  rows: DecisionRow[]
  t: (key: string) => string
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Cell>{t('quality.decisions.cols.tradeDate')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.ticker')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.signal')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.confidence')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.rawReturn')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.alpha')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.win')}</Table.Cell>
          <Table.Cell>{t('quality.decisions.cols.actions')}</Table.Cell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.id}>
            <Table.Cell>{row.trade_date}</Table.Cell>
            <Table.Cell>{row.ticker}</Table.Cell>
            <Table.Cell>
              {row.signal ? <Badge variant={signalBadgeVariant(row.signal)}>{row.signal}</Badge> : '-'}
            </Table.Cell>
            <Table.Cell>{row.confidence != null ? row.confidence.toFixed(2) : '-'}</Table.Cell>
            <Table.Cell><span className={marketClass(row.raw_return)}>{formatPct(row.raw_return)}</span></Table.Cell>
            <Table.Cell><span className={marketClass(row.alpha)}>{formatPct(row.alpha)}</span></Table.Cell>
            <Table.Cell>
              {!row.evaluable ? (
                <Badge variant="secondary">{t('quality.decisions.pending')}</Badge>
              ) : row.win === true ? (
                <Badge variant="success">{t('quality.decisions.win')}</Badge>
              ) : row.win === false ? (
                <Badge variant="error">{t('quality.decisions.loss')}</Badge>
              ) : '-'}
            </Table.Cell>
            <Table.Cell>
              <Link to={`/report/${row.id}`} className="kumo-link-reset">
                <Button size="sm" icon={Eye} variant="secondary">{t('quality.decisions.openReport')}</Button>
              </Link>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
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

function formatPct(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

function formatRate(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${(value * 100).toFixed(1)}%`
}

function formatNumber(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return value.toFixed(2)
}

function marketClass(value?: number | null) {
  if (value == null) return undefined
  return value >= 0 ? 'market-up' : 'market-down'
}

function winRateClass(value?: number | null) {
  if (value == null) return undefined
  return value >= 0.5 ? 'market-up' : 'market-down'
}

function alphaToColor(alpha?: number | null) {
  if (alpha == null || !Number.isFinite(alpha)) return '#ebedf0'
  const clamped = Math.max(-0.1, Math.min(0.1, alpha))
  const ratio = Math.abs(clamped) / 0.1
  if (clamped >= 0) {
    const green = Math.round(230 - ratio * 145)
    const blue = Math.round(220 - ratio * 130)
    return `rgb(220, ${green}, ${blue})`
  }
  const red = Math.round(220 - ratio * 145)
  const blue = Math.round(220 - ratio * 120)
  return `rgb(${red}, 210, ${blue})`
}
