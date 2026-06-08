import {
  Badge,
  Banner,
  Button,
  Checkbox,
  Input,
  Radio,
  Select,
  Switch,
} from '@cloudflare/kumo'
import { RocketLaunch } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ModelPicker } from '../components/ModelPicker'
import { ErrorBanner, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage, todayIsoDate } from '../lib/format'
import { fetchModelCatalog, fetchProviderConnections } from '../lib/settings'
import type { ModelCatalog, ProviderConnection } from '../lib/types'

type TickerClass = 'cn' | 'us' | 'hk' | 'crypto' | 'unknown'

interface ParsedQuery {
  ticker: string
  company_name: string
  trade_date: string
  period_days: number
  period_label: string
  confidence: number
  source: string
  notes: string
}

interface AnalyzeForm {
  ticker: string
  trade_date: string
  asset_type: string
  analysts: string[]
  max_debate_rounds: number
  max_risk_discuss_rounds: number
  llm_provider: string
  deep_think_llm: string
  quick_think_llm: string
  output_language: string
  checkpoint_enabled: boolean
}

const analystKeys = [
  'market',
  'social',
  'news',
  'fundamentals',
  'cn_social',
  'event',
  'capital_flow',
  'macro',
]

const defaultsByClass: Record<TickerClass, string[]> = {
  cn: ['market', 'news', 'fundamentals', 'cn_social', 'event', 'capital_flow', 'macro'],
  us: ['market', 'social', 'news', 'fundamentals', 'event'],
  hk: ['market', 'social', 'news', 'fundamentals', 'event', 'capital_flow'],
  crypto: ['market', 'news', 'event'],
  unknown: ['market', 'social', 'news', 'fundamentals', 'cn_social', 'event'],
}

function classifyTicker(ticker: string, assetType: string): TickerClass {
  if (assetType === 'crypto') return 'crypto'
  const value = ticker.trim().toUpperCase()
  if (!value) return 'unknown'
  if (/\.(SS|SZ|SH|BJ)$/i.test(value) || /^\d{6}$/.test(value)) return 'cn'
  if (/\.HK$/i.test(value) || /^\d{4,5}$/.test(value)) return 'hk'
  return 'us'
}

export function AnalyzePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<AnalyzeForm>(() => ({
    ticker: searchParams.get('ticker') || '',
    trade_date: todayIsoDate(),
    asset_type: searchParams.get('asset_type') || 'stock',
    analysts: defaultsByClass.unknown,
    max_debate_rounds: 1,
    max_risk_discuss_rounds: 1,
    llm_provider: '',
    deep_think_llm: '',
    quick_think_llm: '',
    output_language: 'Chinese',
    checkpoint_enabled: false,
  }))
  const [tickerClass, setTickerClass] = useState<TickerClass>(() =>
    classifyTicker(form.ticker, form.asset_type),
  )
  const [catalog, setCatalog] = useState<ModelCatalog>({})
  const [providers, setProviders] = useState<ProviderConnection[]>([])
  const [nlQuery, setNlQuery] = useState('')
  const [useLlmFallback, setUseLlmFallback] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedQuery | null>(null)
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([fetchModelCatalog(), fetchProviderConnections()])
      .then(([nextCatalog, nextProviders]) => {
        if (!active) return
        setCatalog(nextCatalog)
        setProviders(nextProviders.providers)
        setForm((current) => ({
          ...current,
          llm_provider: current.llm_provider || nextProviders.providers[0]?.provider || '',
        }))
      })
      .catch((err: unknown) => setError(errorMessage(err, t('common.unknownError'))))
    return () => {
      active = false
    }
  }, [t])

  useEffect(() => {
    const next = classifyTicker(form.ticker, form.asset_type)
    if (next === tickerClass) return
    setTickerClass(next)
    setForm((current) => ({ ...current, analysts: defaultsByClass[next] }))
  }, [form.asset_type, form.ticker, tickerClass])

  const providerItems = providers.map((provider) => ({
    label: provider.label,
    value: provider.provider,
  }))
  const deepModelOptions = catalog[form.llm_provider.toLowerCase()]?.deep || []
  const quickModelOptions = catalog[form.llm_provider.toLowerCase()]?.quick || []
  const analystHint = useMemo(() => {
    const classLabel = t(`analyze.tickerClass.${tickerClass}`)
    return t('analyze.analystHint', { cls: classLabel })
  }, [t, tickerClass])

  function update<K extends keyof AnalyzeForm>(key: K, value: AnalyzeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function runParse() {
    if (!nlQuery.trim()) return
    setParsing(true)
    setParseResult(null)
    setError('')
    try {
      const { data } = await api.post<{ result: ParsedQuery }>('/api/parse-query', {
        text: nlQuery,
        use_llm_fallback: useLlmFallback,
      })
      const result = data.result
      setParseResult(result)
      if (result.ticker) {
        setForm((current) => ({
          ...current,
          ticker: result.ticker,
          trade_date: result.trade_date || current.trade_date,
        }))
      }
    } catch (err) {
      setError(`${t('analyze.parseFailPrefix')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setParsing(false)
    }
  }

  async function submit() {
    if (!form.ticker || !form.trade_date) {
      setError(t('analyze.tickerPlaceholder'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const { data } = await api.post<{ id: string }>('/api/analyze', form)
      navigate(`/progress/${data.id}`)
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader title={t('analyze.title')} subtitle={t('analyze.subtitle')} />
      <ErrorBanner message={error} />

      <SectionCard
        title={t('analyze.smartParse')}
        extra={<Badge variant="beta">Beta</Badge>}
      >
        <div className="kumo-form-grid kumo-form-grid-inline">
          <Input
            label={t('analyze.smartParse')}
            value={nlQuery}
            placeholder={t('analyze.smartParsePlaceholder')}
            onChange={(event) => setNlQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runParse()
            }}
          />
          <Button loading={parsing} disabled={!nlQuery.trim()} onClick={runParse}>
            {t('analyze.runParse')}
          </Button>
        </div>
        <div className="kumo-inline-controls">
          <Checkbox
            label={t('analyze.useLlmFallback')}
            checked={useLlmFallback}
            onCheckedChange={(checked) => setUseLlmFallback(Boolean(checked))}
          />
          <span>{t('analyze.parseHint')}</span>
        </div>
        {parseResult ? (
          <Banner
            variant={parseResult.ticker ? (parseResult.confidence >= 0.8 ? 'default' : 'alert') : 'error'}
            title={
              parseResult.ticker
                ? `${t('analyze.parsedAs')}${parseResult.company_name || parseResult.ticker}`
                : t('analyze.parseFailedTitle')
            }
            description={`${parseResult.notes} · ${parseResult.source} · ${t('analyze.confidence')} ${parseResult.confidence}`}
          />
        ) : null}
      </SectionCard>

      <SectionCard>
        <div className="kumo-form-grid">
          <Input
            label={t('common.ticker')}
            value={form.ticker}
            placeholder={t('analyze.tickerPlaceholder')}
            onChange={(event) => update('ticker', event.currentTarget.value.toUpperCase())}
          />
          <Input
            type="date"
            label={t('analyze.tradeDate')}
            value={form.trade_date}
            onChange={(event) => update('trade_date', event.currentTarget.value)}
          />
          <Radio.Group
            legend={t('common.assetType')}
            orientation="horizontal"
            value={form.asset_type}
            onValueChange={(value) => update('asset_type', value)}
          >
            <Radio.Item value="stock" label={t('common.stock')} />
            <Radio.Item value="crypto" label={t('common.crypto')} />
          </Radio.Group>
          <Checkbox.Group
            legend={t('analyze.analystTeam')}
            value={form.analysts}
            allValues={analystKeys}
            onValueChange={(value) => update('analysts', value)}
            description={analystHint}
          >
            {analystKeys.map((key) => (
              <Checkbox.Item key={key} value={key} label={t(`analyze.analysts.${key === 'cn_social' ? 'cnSocial' : key === 'capital_flow' ? 'capitalFlow' : key}`)} />
            ))}
          </Checkbox.Group>
          <Input
            type="number"
            min={1}
            max={5}
            step={2}
            label={t('analyze.debateDepth')}
            value={form.max_debate_rounds}
            onChange={(event) => update('max_debate_rounds', Number(event.currentTarget.value))}
          />
          <Input
            type="number"
            min={1}
            max={3}
            label={t('analyze.riskRounds')}
            value={form.max_risk_discuss_rounds}
            onChange={(event) => update('max_risk_discuss_rounds', Number(event.currentTarget.value))}
          />
          <Select
            label={t('analyze.provider')}
            value={form.llm_provider}
            items={providerItems}
            placeholder={t('analyze.providerPlaceholder')}
            onValueChange={(value) => update('llm_provider', String(value || ''))}
          />
          <ModelPicker
            label={t('analyze.deepModel')}
            value={form.deep_think_llm}
            options={deepModelOptions}
            placeholder={t('analyze.deepModelPlaceholder')}
            onChange={(value) => update('deep_think_llm', value)}
          />
          <ModelPicker
            label={t('analyze.quickModel')}
            value={form.quick_think_llm}
            options={quickModelOptions}
            placeholder={t('analyze.quickModelPlaceholder')}
            onChange={(value) => update('quick_think_llm', value)}
          />
          <Select
            label={t('analyze.outputLanguage')}
            value={form.output_language}
            items={[
              { label: '中文', value: 'Chinese' },
              { label: 'English', value: 'English' },
              { label: '日本語', value: 'Japanese' },
            ]}
            onValueChange={(value) => update('output_language', String(value || ''))}
          />
          <Switch
            label={t('analyze.checkpoint')}
            checked={form.checkpoint_enabled}
            onCheckedChange={(checked) => update('checkpoint_enabled', checked)}
          />
        </div>
        <div className="kumo-form-actions">
          <Button loading={submitting} onClick={submit}>
            <RocketLaunch size={16} />
            {t('analyze.startAnalysis')}
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
