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
} from '@cloudflare/kumo'
import { ClockCounterClockwise, MagnifyingGlass } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage } from '../lib/format'

interface ScreenCandidate {
  ticker: string
  name?: string
  rank?: number
  score?: number
  reason?: string
  reason_source?: 'llm' | 'rule' | string
  risk?: string
  metrics?: {
    price?: number
    change_pct?: number
    pe?: number
    pb?: number
    market_cap?: number
    turnover?: number
  }
  factor_breakdown?: {
    value?: number
    momentum?: number
    capital_flow?: number
    risk?: number
  }
}

interface ScreenStrategy {
  labels?: string[]
  coverage?: string
  provenance?: {
    source?: string
    labels?: string[]
  }
}

interface ScreenHistoryItem {
  id: string
  text: string
  status: string
  created_at: string
}

interface ScreenEvent {
  type: string
  content?: string
  strategy?: ScreenStrategy
  candidates?: ScreenCandidate[]
  matched?: number
  data_source?: string
  coverage?: string
}

interface ScreenFilters {
  pe_max: string
  pb_max: string
  market_cap_min: string
  market_cap_max: string
  sector_query: string
}

const lastRunKey = 'screener:lastRunId'
const topPresets = [20, 50, 100, 200]

export function ScreenerPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const wsRef = useRef<WebSocket | null>(null)
  const [goal, setGoal] = useState('')
  const [topN, setTopN] = useState(20)
  const [useLlm, setUseLlm] = useState(true)
  const [momentumPeriod, setMomentumPeriod] = useState('today')
  const [momentumDirection, setMomentumDirection] = useState('up')
  const [filters, setFilters] = useState<ScreenFilters>({
    pe_max: '',
    pb_max: '',
    market_cap_min: '',
    market_cap_max: '',
    sector_query: '',
  })
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState('')
  const [strategy, setStrategy] = useState<ScreenStrategy | null>(null)
  const [matched, setMatched] = useState<number | null>(null)
  const [dataSource, setDataSource] = useState('')
  const [degraded, setDegraded] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [candidates, setCandidates] = useState<ScreenCandidate[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sizingOpen, setSizingOpen] = useState(false)
  const [sizing, setSizing] = useState<'equal_cash' | 'fixed_cash' | 'fixed_shares'>('equal_cash')
  const [sizingValue, setSizingValue] = useState(0.5)
  const [addingPaper, setAddingPaper] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState<ScreenHistoryItem[]>([])

  const strategyLabels = strategy?.provenance?.labels || strategy?.labels || []
  const allSelected = candidates.length > 0 && selected.length === candidates.length
  const someSelected = selected.length > 0 && selected.length < candidates.length

  const periodItems = useMemo(() => [
    { label: t('screener.periodToday'), value: 'today' },
    { label: t('screener.period5d'), value: '5d' },
    { label: t('screener.period20d'), value: '20d' },
    { label: t('screener.period60d'), value: '60d' },
    { label: t('screener.periodYtd'), value: 'ytd' },
  ], [t])
  const directionItems = useMemo(() => [
    { label: t('screener.directionUp'), value: 'up' },
    { label: t('screener.directionDown'), value: 'down' },
  ], [t])

  const cleanFilters = useCallback(() => {
    const output: Record<string, unknown> = {
      momentum_period: momentumPeriod,
      momentum_direction: momentumDirection,
    }
    for (const [key, value] of Object.entries(filters)) {
      if (!value) continue
      output[key] = key === 'sector_query' ? value : Number(value)
    }
    return output
  }, [filters, momentumDirection, momentumPeriod])

  const refreshHistory = useCallback(async () => {
    try {
      const { data } = await api.get<{ items?: ScreenHistoryItem[] }>('/api/screen')
      setHistoryItems(data.items || [])
    } catch {
      // Non-fatal; the page can still screen without history.
    }
  }, [])

  const loadHistory = useCallback(async (id: string, options: { silent?: boolean } = {}) => {
    try {
      const { data } = await api.get<{
        id: string
        text?: string
        strategy?: ScreenStrategy
        candidates?: ScreenCandidate[]
      }>(`/api/screen/${id}`)
      setRunId(data.id)
      setGoal(data.text || '')
      setStrategy(data.strategy || null)
      setCandidates(data.candidates || [])
      setSelected([])
      setMatched(null)
      setProgressMsg('')
      setDegraded(Boolean(data.strategy?.coverage === 'partial'))
      setHistoryOpen(false)
      localStorage.setItem(lastRunKey, data.id)
    } catch (err) {
      if (options.silent) {
        localStorage.removeItem(lastRunKey)
        return
      }
      setError(errorMessage(err, t('common.failed')))
    }
  }, [t])

  useEffect(() => {
    refreshHistory()
    const last = localStorage.getItem(lastRunKey)
    if (last) loadHistory(last, { silent: true })
  }, [loadHistory, refreshHistory])

  useEffect(() => () => {
    wsRef.current?.close()
  }, [])

  useEffect(() => {
    if (sizing === 'equal_cash') setSizingValue(0.5)
    if (sizing === 'fixed_cash') setSizingValue(10000)
    if (sizing === 'fixed_shares') setSizingValue(100)
  }, [sizing])

  function connect(id: string) {
    wsRef.current?.close()
    const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/screen/${id}`
    const socket = new WebSocket(url)
    wsRef.current = socket
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as ScreenEvent
      if (event.strategy) setStrategy(event.strategy)
      if (event.matched != null) setMatched(event.matched)
      if (event.data_source) setDataSource(event.data_source)
      if (event.coverage === 'partial') setDegraded(true)
      if (event.type === 'warning') {
        setNotice(event.content || '')
        return
      }
      if (event.content) setProgressMsg(event.content)
      if (event.type === 'screen_complete') {
        setCandidates(event.candidates || [])
        setRunning(false)
        setProgressMsg('')
        if (id) localStorage.setItem(lastRunKey, id)
        refreshHistory()
        socket.close()
      } else if (event.type === 'error') {
        setRunning(false)
        setError(event.content || t('common.failed'))
        socket.close()
      }
    }
    socket.onerror = () => {
      setRunning(false)
      setError(t('common.failed'))
    }
  }

  async function startScreen() {
    setRunning(true)
    setError('')
    setNotice('')
    setStrategy(null)
    setMatched(null)
    setDataSource('')
    setDegraded(false)
    setProgressMsg('')
    setCandidates([])
    setSelected([])
    try {
      const requestFilters = cleanFilters()
      const { data } = await api.post<{ id: string }>('/api/screen', {
        text: goal,
        filters: Object.keys(requestFilters).length ? requestFilters : null,
        top_n: topN,
        use_llm: useLlm,
      })
      setRunId(data.id)
      connect(data.id)
    } catch (err) {
      setRunning(false)
      setError(errorMessage(err, t('common.failed')))
    }
  }

  function toggleSelected(ticker: string, checked: boolean) {
    setSelected((current) => (
      checked ? Array.from(new Set([...current, ticker])) : current.filter((item) => item !== ticker)
    ))
  }

  async function confirmAddToPaper() {
    if (!selected.length) {
      setError(t('screener.emptySelect'))
      return
    }
    setAddingPaper(true)
    setError('')
    try {
      const { data } = await api.post<{
        filled: number
        total: number
        results?: Array<{ ticker: string; filled: boolean; reason?: string }>
      }>(`/api/screen/${runId}/to-paper`, {
        tickers: selected,
        sizing,
        value: sizingValue,
      })
      setSizingOpen(false)
      const failed = (data.results || []).filter((result) => !result.filled)
      setNotice(t('screener.toPaperDone', { filled: data.filled, total: data.total }))
      if (failed.length) {
        setError(failed.map((item) => `${item.ticker}: ${item.reason}`).join('; '))
      }
    } catch (err) {
      setError(errorMessage(err, t('common.failed')))
    } finally {
      setAddingPaper(false)
    }
  }

  async function batchAnalyze() {
    if (!selected.length) {
      setError(t('screener.emptySelect'))
      return
    }
    setAnalyzing(true)
    setError('')
    try {
      const { data } = await api.post<{
        total: number
        started?: Array<{ ticker: string; analysis_id: string }>
      }>(`/api/screen/${runId}/to-analyze`, {
        tickers: selected,
      })
      setNotice(t('screener.toAnalyzeDone', { n: data.total }))
      if (data.started?.length === 1) navigate(`/progress/${data.started[0].analysis_id}`)
      else navigate('/history')
    } catch (err) {
      setError(errorMessage(err, t('common.failed')))
    } finally {
      setAnalyzing(false)
    }
  }

  const sizingHint = sizing === 'equal_cash'
    ? t('screener.sizingEqualCashHint')
    : sizing === 'fixed_cash'
      ? t('screener.sizingFixedCashHint')
      : t('screener.sizingFixedSharesHint')

  return (
    <div className="kumo-page-stack">
      <PageHeader title={t('screener.title')} subtitle={t('screener.subtitle')} />
      <ErrorBanner message={error} />
      {notice ? <Banner variant="default" title={notice} /> : null}

      <SectionCard>
        <div className="kumo-screener-search">
          <Input
            label={t('screener.title')}
            value={goal}
            placeholder={t('screener.goalPlaceholder')}
            onChange={(event) => setGoal(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startScreen()
            }}
          />
          <Input
            type="number"
            min={5}
            max={500}
            step={10}
            label={t('screener.topN')}
            value={topN}
            onChange={(event) => setTopN(Number(event.currentTarget.value))}
          />
          <Button loading={running} onClick={startScreen}>
            <MagnifyingGlass size={16} />
            {running ? t('screener.running') : t('screener.start')}
          </Button>
        </div>
        <div className="kumo-inline-controls">
          <span>{t('screener.topN')}:</span>
          {topPresets.map((preset) => (
            <Button
              key={preset}
              size="xs"
              variant={topN === preset ? 'primary' : 'secondary'}
              onClick={() => setTopN(preset)}
            >
              {preset}
            </Button>
          ))}
          <Checkbox
            label={t('screener.useLlm')}
            checked={useLlm}
            onCheckedChange={(checked) => setUseLlm(Boolean(checked))}
          />
          <Select
            aria-label={t('screener.momentumPeriod')}
            value={momentumPeriod}
            items={periodItems}
            onValueChange={(value) => setMomentumPeriod(String(value || 'today'))}
          />
          <Select
            aria-label={t('screener.momentumDirection')}
            value={momentumDirection}
            items={directionItems}
            onValueChange={(value) => setMomentumDirection(String(value || 'up'))}
          />
          <Button size="sm" onClick={() => {
            setHistoryOpen(true)
            refreshHistory()
          }}>
            <ClockCounterClockwise size={16} />
            {historyItems.length
              ? t('screener.historyCount', { n: historyItems.length })
              : t('screener.history')}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t('screener.advanced')}>
        <div className="kumo-filter-row screener">
          <Input type="number" min={0} label={t('screener.peMax')} value={filters.pe_max} onChange={(event) => setFilters((current) => ({ ...current, pe_max: event.currentTarget.value }))} />
          <Input type="number" min={0} label={t('screener.pbMax')} value={filters.pb_max} onChange={(event) => setFilters((current) => ({ ...current, pb_max: event.currentTarget.value }))} />
          <Input type="number" min={0} label={t('screener.mcMin')} value={filters.market_cap_min} onChange={(event) => setFilters((current) => ({ ...current, market_cap_min: event.currentTarget.value }))} />
          <Input type="number" min={0} label={t('screener.mcMax')} value={filters.market_cap_max} onChange={(event) => setFilters((current) => ({ ...current, market_cap_max: event.currentTarget.value }))} />
          <Input label={t('screener.sector')} value={filters.sector_query} onChange={(event) => setFilters((current) => ({ ...current, sector_query: event.currentTarget.value }))} />
        </div>
      </SectionCard>

      {degraded ? (
        <Banner
          variant="alert"
          title={t('screener.degradedTitle')}
          description={t('screener.degradedBody', { source: dataSource || '新浪' })}
        />
      ) : null}

      {strategy || progressMsg ? (
        <SectionCard>
          <div className="kumo-strategy-row">
            <strong>{t('screener.strategy')}:</strong>
            {strategyLabels.map((label, index) => <Badge key={`${label}-${index}`} variant="info">{label}</Badge>)}
            {strategy?.provenance?.source ? <Badge variant="secondary">{strategy.provenance.source}</Badge> : null}
            {matched != null ? <span>{t('screener.matched')} {matched}</span> : null}
            {dataSource ? <Badge variant="outline">{t('screener.dataSource')}: {dataSource}</Badge> : null}
            {progressMsg ? <span>{progressMsg}</span> : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={t('screener.candidates')}
        extra={selected.length ? (
          <div className="kumo-row-actions">
            <span className="kumo-muted-text">{t('screener.selected', { n: selected.length })}</span>
            <Button size="sm" onClick={() => setSizingOpen(true)}>{t('screener.addToPaper')}</Button>
            <Button size="sm" loading={analyzing} onClick={batchAnalyze}>{t('screener.batchAnalyze')}</Button>
          </div>
        ) : null}
      >
        {candidates.length ? (
          <KumoTable>
            <Table.Header>
              <Table.Row>
                <Table.CheckHead
                  checked={allSelected}
                  indeterminate={someSelected}
                  label={t('screener.selected', { n: selected.length })}
                  onCheckedChange={(checked) => setSelected(checked ? candidates.map((item) => item.ticker) : [])}
                />
                <Table.Head>{t('screener.columns.rank')}</Table.Head>
                <Table.Head>{t('screener.columns.name')}</Table.Head>
                <Table.Head>{t('screener.columns.price')}</Table.Head>
                <Table.Head>{t('screener.columns.changePct')}</Table.Head>
                <Table.Head>{t('screener.columns.pe')}</Table.Head>
                <Table.Head>{t('screener.columns.pb')}</Table.Head>
                <Table.Head>{t('screener.columns.marketCap')}</Table.Head>
                <Table.Head>{t('screener.columns.turnover')}</Table.Head>
                <Table.Head>{t('screener.columns.score')}</Table.Head>
                <Table.Head>{t('screener.columns.reason')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {candidates.map((candidate) => {
                const checked = selected.includes(candidate.ticker)
                return (
                  <Table.Row key={candidate.ticker} variant={checked ? 'selected' : 'default'}>
                    <Table.CheckCell
                      checked={checked}
                      label={candidate.ticker}
                      onCheckedChange={(next) => toggleSelected(candidate.ticker, next)}
                    />
                    <Table.Cell>{candidate.rank || '-'}</Table.Cell>
                    <Table.Cell>
                      <strong>{candidate.name || candidate.ticker}</strong>
                      <span className="kumo-cell-subtext">{candidate.ticker}</span>
                    </Table.Cell>
                    <Table.Cell>{fmt(candidate.metrics?.price)}</Table.Cell>
                    <Table.Cell>
                      {candidate.metrics?.change_pct == null ? '-' : (
                        <span className={candidate.metrics.change_pct >= 0 ? 'market-up' : 'market-down'}>
                          {candidate.metrics.change_pct >= 0 ? '+' : ''}{fmt(candidate.metrics.change_pct)}%
                        </span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{fmt(candidate.metrics?.pe)}</Table.Cell>
                    <Table.Cell>{fmt(candidate.metrics?.pb)}</Table.Cell>
                    <Table.Cell>{fmt(candidate.metrics?.market_cap, 0)}</Table.Cell>
                    <Table.Cell>{fmt(candidate.metrics?.turnover)}</Table.Cell>
                    <Table.Cell>
                      <Badge variant="info">{fmt(candidate.score)}</Badge>
                      <span className="kumo-cell-subtext">
                        {t('screener.value')}: {fmt(candidate.factor_breakdown?.value)} · {t('screener.momentum')}: {fmt(candidate.factor_breakdown?.momentum)} · {t('screener.capitalFlow')}: {fmt(candidate.factor_breakdown?.capital_flow)}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="kumo-reason-cell">
                        <Badge variant={candidate.reason_source === 'llm' ? 'success' : 'secondary'}>
                          {candidate.reason_source === 'llm' ? t('screener.reasonSourceLlm') : t('screener.reasonSourceRule')}
                        </Badge>
                        <span>{candidate.reason || '-'}</span>
                        {candidate.risk ? <small>{candidate.risk}</small> : null}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </KumoTable>
        ) : (
          <LoadingEmpty loading={running} title={t('screener.noData')} />
        )}
      </SectionCard>

      <Dialog.Root open={sizingOpen} onOpenChange={setSizingOpen}>
        <Dialog>
          <Dialog.Title>{t('screener.sizingTitle')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Radio.Group
              legend={t('screener.sizingTitle')}
              value={sizing}
              onValueChange={(value) => setSizing(value as typeof sizing)}
            >
              <Radio.Item value="equal_cash" label={t('screener.sizingEqualCash')} />
              <Radio.Item value="fixed_cash" label={t('screener.sizingFixedCash')} />
              <Radio.Item value="fixed_shares" label={t('screener.sizingFixedShares')} />
            </Radio.Group>
            <Input
              type="number"
              min={0}
              max={sizing === 'equal_cash' ? 1 : undefined}
              step={sizing === 'equal_cash' ? 0.1 : 100}
              label={sizing === 'equal_cash' ? t('screener.sizingEqualCash') : sizing === 'fixed_cash' ? t('screener.sizingFixedCash') : t('screener.sizingFixedShares')}
              value={sizingValue}
              onChange={(event) => setSizingValue(Number(event.currentTarget.value))}
              description={sizingHint}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button {...props}>{t('common.cancel')}</Button>} />
            <Button loading={addingPaper} onClick={confirmAddToPaper}>{t('screener.confirmBuy')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={historyOpen} onOpenChange={setHistoryOpen}>
        <Dialog size="lg">
          <Dialog.Title>{t('screener.history')}</Dialog.Title>
          <div className="kumo-history-list">
            {historyItems.length ? historyItems.map((item) => (
              <button key={item.id} type="button" onClick={() => loadHistory(item.id)}>
                <span>
                  <strong>{item.text || t('screener.noData')}</strong>
                  <small>{fmtTime(item.created_at)}</small>
                </span>
                <Badge variant={item.status === 'complete' ? 'success' : item.status === 'error' ? 'error' : 'secondary'}>
                  {item.status}
                </Badge>
              </button>
            )) : <LoadingEmpty loading={false} title={t('screener.historyEmpty')} />}
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function fmt(value: unknown, digits = 2) {
  if (value == null || value === '') return '-'
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return '-'
  return numberValue.toFixed(digits)
}

function fmtTime(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
