import {
  Badge,
  Banner,
  Button,
  Dialog,
  Empty,
  Input,
  Radio,
  Table,
  Tabs,
} from '@cloudflare/kumo'
import { Check, DownloadSimple, FolderSimpleDashed, Plus, RocketLaunch, X } from '@phosphor-icons/react'
import { marked } from 'marked'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DebateThread } from '../components/DebateThread'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage, signalBadgeVariant } from '../lib/format'

interface Analysis {
  id: string
  ticker: string
  trade_date: string
  signal: string | null
  confidence: number | null
  status: string
  created_at: string
  completed_at: string | null
  asset_type: string
}

interface AgentReport {
  id?: number
  analysis_id?: string
  report_type: string
  content: string
  created_at?: string
}

interface AgentEvent {
  id: number
  event_type: string
  agent_name: string
  timestamp: string
}

interface ReportResponse {
  analysis: Analysis
  reports: AgentReport[]
  events: AgentEvent[]
}

interface ReportTab {
  key: string
  label: string
  content: string
}

const tabOrder = [
  'macro',
  'market',
  'sentiment',
  'cn_sentiment',
  'news',
  'fundamentals',
  'capital_flow',
  'event',
  'invest_debate',
  'research_plan',
  'trader_proposal',
  'risk_debate',
  'final_decision',
]

export function ReportDetailPage() {
  const { t } = useI18n()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [reports, setReports] = useState<AgentReport[]>([])
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [paperOpen, setPaperOpen] = useState(false)
  const [paperForm, setPaperForm] = useState({
    mode: 'fraction' as 'shares' | 'fraction',
    shares: '',
    cashFractionPct: 25,
    price: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<ReportResponse>(`/api/reports/${id}`)
      setAnalysis(data.analysis)
      setReports(data.reports || [])
      setEvents(data.events || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    load()
  }, [load])

  const tabs = useMemo(() => buildTabs(reports, t), [reports, t])

  useEffect(() => {
    if (!tab && tabs.length) setTab(tabs[0].key)
    if (tab && tabs.length && !tabs.some((item) => item.key === tab)) setTab(tabs[0].key)
  }, [tab, tabs])

  const activeTab = tabs.find((item) => item.key === tab) || tabs[0] || null
  const bullHistory = reportByType(reports, 'bull_debate')
  const bearHistory = reportByType(reports, 'bear_debate')
  const canPaperOrder = analysis?.status === 'complete' && (analysis.signal === 'BUY' || analysis.signal === 'SELL')

  async function exportMarkdown() {
    if (!id) return
    setError('')
    try {
      const { data } = await api.get<{ content: string }>(`/api/reports/${id}/export?format=md`)
      const blob = new Blob([data.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `report_${analysis?.ticker || id}_${analysis?.trade_date || ''}.md`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    }
  }

  async function submitPaperOrder() {
    if (!id) return
    const payload: Record<string, string | number> = { analysis_id: id }
    if (paperForm.mode === 'shares') {
      const shares = Number(paperForm.shares)
      if (!shares || shares <= 0) {
        setError(t('report.paperOrder.validation'))
        return
      }
      payload.shares = shares
    } else {
      payload.cash_fraction = paperForm.cashFractionPct / 100
    }
    const price = Number(paperForm.price)
    if (price > 0) payload.price = price

    setPlacing(true)
    setError('')
    try {
      const { data } = await api.post('/api/paper/orders/from-decision', payload)
      const action = data.action === 'buy' ? t('report.paperOrder.buy') : t('report.paperOrder.sell')
      setNotice(t('report.paperOrder.placed', { action, shares: data.shares, price: data.price }))
      setPaperOpen(false)
    } catch (err) {
      setError(`${t('report.paperOrder.failed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('report.titlePrefix', { ticker: analysis?.ticker || '' })}
        subtitle={analysis?.trade_date || id}
        actions={
          <div className="kumo-page-actions">
            {analysis?.signal ? <Badge variant={signalBadgeVariant(analysis.signal)}>{analysis.signal}</Badge> : null}
            <Button icon={DownloadSimple} variant="secondary" onClick={exportMarkdown}>
              {t('report.exportMd')}
            </Button>
            <Button icon={Plus} variant="secondary" disabled={!canPaperOrder} onClick={() => setPaperOpen(true)}>
              {t('report.paperOrderBtn')}
            </Button>
            <Button icon={RocketLaunch} onClick={() => navigate('/analyze')}>
              {t('report.reAnalyze')}
            </Button>
          </div>
        }
      />

      <ErrorBanner message={error} />
      {notice ? <Banner variant="default" title={notice} /> : null}

      {analysis ? (
        <SectionCard>
          <dl className="kumo-definition-list report-summary">
            <dt>{t('report.summary.ticker')}</dt><dd>{analysis.ticker}</dd>
            <dt>{t('report.summary.date')}</dt><dd>{analysis.trade_date}</dd>
            <dt>{t('report.summary.signal')}</dt><dd>{analysis.signal || '-'}</dd>
            <dt>{t('report.summary.confidence')}</dt><dd>{analysis.confidence ?? '-'}</dd>
            <dt>{t('report.summary.status')}</dt><dd>{analysis.status}</dd>
            <dt>{t('report.summary.createdAt')}</dt><dd>{analysis.created_at}</dd>
            <dt>{t('report.summary.completedAt')}</dt><dd>{analysis.completed_at || '-'}</dd>
            <dt>{t('report.summary.assetType')}</dt><dd>{analysis.asset_type}</dd>
          </dl>
        </SectionCard>
      ) : (
        <SectionCard>
          <LoadingEmpty loading={loading} title={t('report.noReports')} />
        </SectionCard>
      )}

      <SectionCard>
        {tabs.length ? (
          <>
            <div className="kumo-tabs-wrap">
              <Tabs
                value={activeTab?.key || ''}
                onValueChange={setTab}
                tabs={tabs.map((item) => ({ value: item.key, label: item.label }))}
              />
            </div>
            <div className="report-tab-panel">
              {activeTab ? (
                activeTab.key === 'event' ? (
                  <EventReport content={activeTab.content} />
                ) : activeTab.key === 'invest_debate' ? (
                  <DebateThread bullHistory={bullHistory} bearHistory={bearHistory} emptyText={t('report.investDebateEmpty')} />
                ) : activeTab.key === 'risk_debate' ? (
                  <DebateThread history={activeTab.content} emptyText={t('report.riskDebateEmpty')} />
                ) : (
                  <MarkdownBlock content={activeTab.content} />
                )
              ) : null}
            </div>
          </>
        ) : (
          <Empty
            size="sm"
            icon={loading ? undefined : <FolderSimpleDashed size={24} />}
            title={loading ? t('common.saving') : t('report.noReports')}
            className="kumo-empty-dashed"
          />
        )}
      </SectionCard>

      {events.length ? (
        <SectionCard title={t('report.timelineTitle')}>
          <div className="kumo-timeline report">
            {events.map((event) => (
              <article key={event.id}>
                <header>
                  <strong>{event.agent_name}</strong>
                  <Badge variant={event.event_type === 'error' ? 'error' : 'success'}>{event.event_type}</Badge>
                </header>
                <p>{event.timestamp}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <Dialog.Root open={paperOpen} onOpenChange={setPaperOpen}>
        <Dialog>
          <Dialog.Title>{t('report.paperOrder.title')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Banner variant="alert" title={t('report.paperOrder.warning')} />
            <Radio.Group
              legend={t('report.paperOrder.mode')}
              orientation="horizontal"
              value={paperForm.mode}
              onValueChange={(value) => setPaperForm((current) => ({ ...current, mode: value as 'shares' | 'fraction' }))}
            >
              <Radio.Item value="shares" label={t('report.paperOrder.modeShares')} />
              <Radio.Item value="fraction" label={t('report.paperOrder.modeFraction')} />
            </Radio.Group>
            {paperForm.mode === 'shares' ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                label={t('report.paperOrder.shares')}
                value={paperForm.shares}
                onChange={(event) => setPaperForm((current) => ({ ...current, shares: event.currentTarget.value }))}
              />
            ) : (
              <Input
                type="range"
                min={5}
                max={100}
                step={5}
                label={`${t('report.paperOrder.fraction')}: ${paperForm.cashFractionPct}%`}
                value={paperForm.cashFractionPct}
                onChange={(event) => setPaperForm((current) => ({ ...current, cashFractionPct: Number(event.currentTarget.value) }))}
              />
            )}
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('report.paperOrder.priceOverride')}
              value={paperForm.price}
              placeholder={t('report.paperOrder.priceOverridePlaceholder')}
              onChange={(event) => setPaperForm((current) => ({ ...current, price: event.currentTarget.value }))}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={Check} loading={placing} onClick={submitPaperOrder}>{t('common.submit')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function buildTabs(reports: AgentReport[], t: (key: string) => string): ReportTab[] {
  const byType: Record<string, string> = {}
  for (const report of reports) byType[report.report_type] = report.content
  if (byType.bull_debate || byType.bear_debate) byType.invest_debate = '__has_invest_debate__'

  const output: ReportTab[] = []
  for (const key of tabOrder) {
    if (!byType[key]) continue
    output.push({ key, label: tabLabel(key, t), content: byType[key] })
  }
  for (const report of reports) {
    if (tabOrder.includes(report.report_type)) continue
    if (report.report_type === 'bull_debate' || report.report_type === 'bear_debate') continue
    output.push({
      key: report.report_type,
      label: tabLabel(report.report_type, t),
      content: report.content,
    })
  }
  return output
}

function tabLabel(key: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    macro: 'report.tabs.macro',
    market: 'report.tabs.market',
    sentiment: 'report.tabs.sentiment',
    cn_sentiment: 'report.tabs.cnSentiment',
    news: 'report.tabs.news',
    fundamentals: 'report.tabs.fundamentals',
    capital_flow: 'report.tabs.capitalFlow',
    event: 'report.tabs.event',
    invest_debate: 'report.tabs.investDebate',
    research_plan: 'report.tabs.researchPlan',
    trader_proposal: 'report.tabs.traderProposal',
    risk_debate: 'report.tabs.riskDebate',
    final_decision: 'report.tabs.finalDecision',
  }
  return map[key] ? t(map[key]) : key
}

function reportByType(reports: AgentReport[], type: string) {
  return reports.find((report) => report.report_type === type)?.content || ''
}

function MarkdownBlock({ content }: { content: string }) {
  return (
    <div
      className="kumo-markdown report-markdown"
      dangerouslySetInnerHTML={{ __html: marked(content || '') as string }}
    />
  )
}

interface EventItem {
  name: string
  type: string
  affected: string
  causalChain: string
  sentiment: string
  sentimentClass: 'success' | 'error' | 'warning' | 'secondary'
  duration: string
  confidence: string
  rest: string
}

interface ParsedEventReport {
  events: EventItem[]
  stockMatrix: { headers: string[]; rows: Record<string, string>[] }
  sectorMatrix: { headers: string[]; rows: { name: string; direction: string; logic: string; strength: string }[] }
  indexMatrix: { headers: string[]; rows: Record<string, string>[] }
  risk: string
  conclusion: string
}

function EventReport({ content }: { content: string }) {
  const { t } = useI18n()
  const parsed = useMemo(() => parseEventReport(content), [content])

  if (!content) {
    return (
      <Empty
        size="sm"
        icon={<FolderSimpleDashed size={24} />}
        title={t('event.empty')}
        className="kumo-empty-dashed"
      />
    )
  }

  return (
    <div className="event-report">
      {parsed.events.length ? (
        <section>
          <h3>{t('event.eventsTitle')}</h3>
          <div className="event-card-grid">
            {parsed.events.map((event, index) => (
              <article key={`${event.name}-${index}`} className={`event-card sentiment-${event.sentimentClass}`}>
                <header>
                  <strong>{event.name || t('event.fallbackEventName', { n: index + 1 })}</strong>
                  <div>
                    {event.type ? <Badge variant="secondary">{event.type}</Badge> : null}
                    {event.sentiment ? <Badge variant={event.sentimentClass}>{event.sentiment}</Badge> : null}
                    {event.duration ? <Badge variant="info">{event.duration}</Badge> : null}
                    {event.confidence ? <Badge variant="outline">{t('event.confidence', { v: event.confidence })}</Badge> : null}
                  </div>
                </header>
                {event.affected ? <p><span>{t('event.directlyRelated')}</span>{event.affected}</p> : null}
                {event.causalChain ? <CausalChain raw={event.causalChain} /> : null}
                {event.rest ? <MarkdownBlock content={event.rest} /> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {parsed.stockMatrix.rows.length ? (
        <MatrixSection title={t('event.stockMatrix')} headers={parsed.stockMatrix.headers} rows={parsed.stockMatrix.rows} />
      ) : null}

      {parsed.sectorMatrix.rows.length ? (
        <section>
          <h3>{t('event.sectorMatrix')}</h3>
          <div className="sector-grid">
            {parsed.sectorMatrix.rows.map((row, index) => (
              <article key={`${row.name}-${index}`} className={`sector-pill dir-${classifyDirection(row.direction)}`}>
                <strong>{row.name}</strong>
                <span>{row.direction}</span>
                <p>{row.logic}</p>
                {row.strength ? <small>{t('event.sectorStrength', { v: row.strength })}</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {parsed.indexMatrix.rows.length ? (
        <MatrixSection title={t('event.indexMatrix')} headers={parsed.indexMatrix.headers} rows={parsed.indexMatrix.rows} />
      ) : null}

      {parsed.risk ? (
        <section>
          <h3>{t('event.riskTitle')}</h3>
          <Banner variant="alert" title="" description={<MarkdownBlock content={parsed.risk} />} />
        </section>
      ) : null}

      {parsed.conclusion ? (
        <section>
          <h3>{t('event.conclusionTitle')}</h3>
          <div className="event-conclusion"><MarkdownBlock content={parsed.conclusion} /></div>
        </section>
      ) : null}

      <details className="event-raw">
        <summary>{t('event.rawTitle')}</summary>
        <MarkdownBlock content={content} />
      </details>
    </div>
  )
}

function MatrixSection({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: Record<string, string>[]
}) {
  return (
    <section>
      <h3>{title}</h3>
      <KumoTable>
        <Table.Header>
          <Table.Row>
            {headers.map((header) => <Table.Cell key={header}>{header}</Table.Cell>)}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row, index) => (
            <Table.Row key={index}>
              {headers.map((header) => <Table.Cell key={header}>{row[header] || '-'}</Table.Cell>)}
            </Table.Row>
          ))}
        </Table.Body>
      </KumoTable>
    </section>
  )
}

function CausalChain({ raw }: { raw: string }) {
  const { t } = useI18n()
  const labels = [
    t('causal.tiers.event'),
    t('causal.tiers.direct'),
    t('causal.tiers.supply'),
    t('causal.tiers.sector'),
    t('causal.tiers.followup'),
  ]
  const nodes = parseChain(raw)
  return (
    <div className="causal-chain">
      {nodes.map((node, index) => (
        <div key={`${node}-${index}`} className="chain-node">
          <div className={`node-box tier-${index}`}>
            <span>{labels[index] || t('causal.fallback')}</span>
            <strong>{node}</strong>
          </div>
          {index < nodes.length - 1 ? <div className="chain-arrow">↓</div> : null}
        </div>
      ))}
    </div>
  )
}

function parseEventReport(markdown: string): ParsedEventReport {
  const empty = {
    events: [],
    stockMatrix: { headers: [], rows: [] },
    sectorMatrix: { headers: [], rows: [] },
    indexMatrix: { headers: [], rows: [] },
    risk: '',
    conclusion: '',
  }
  if (!markdown) return empty
  const sections = splitSections(markdown)
  return {
    events: parseEvents(sections['一'] || sections['1'] || ''),
    stockMatrix: parseMatrix(sections['二'] || sections['2'] || ''),
    sectorMatrix: parseSectorMatrix(sections['三'] || sections['3'] || ''),
    indexMatrix: parseMatrix(sections['四'] || sections['4'] || ''),
    risk: (sections['五'] || sections['5'] || '').trim(),
    conclusion: (sections['六'] || sections['6'] || '').trim(),
  }
}

function splitSections(markdown: string) {
  const output: Record<string, string> = {}
  const regex = /^#{2,4}\s*([一二三四五六1-6])[、.\s]/gm
  const matches: { num: string; start: number; headerEnd: number }[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    matches.push({ num: match[1], start: match.index, headerEnd: match.index + match[0].length })
  }
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const end = index + 1 < matches.length ? matches[index + 1].start : markdown.length
    const headerLineEnd = markdown.indexOf('\n', current.headerEnd)
    const bodyStart = headerLineEnd >= 0 ? headerLineEnd + 1 : current.headerEnd
    output[current.num] = markdown.slice(bodyStart, end).trim()
  }
  return output
}

function parseEvents(body: string): EventItem[] {
  if (!body) return []
  return splitEventBlocks(body)
    .map(blockToEvent)
    .filter((event) => event.name || event.affected || event.causalChain || event.rest)
}

function splitEventBlocks(body: string) {
  const blocks: string[] = []
  let current: string[] = []
  for (const line of body.split('\n')) {
    if (/^\s*-?\s*\*\*事件名称/.test(line) && current.length) {
      blocks.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length) blocks.push(current.join('\n'))
  return blocks.map((block) => block.trim()).filter(Boolean)
}

function blockToEvent(block: string): EventItem {
  const fields = extractBulletFields(block)
  const sentiment = fields['情绪方向'] || fields['情绪'] || ''
  return {
    name: fields['事件名称'] || '',
    type: fields['事件类型'] || '',
    affected: fields['直接受益/受损方'] || fields['直接受益方'] || fields['直接受损方'] || '',
    causalChain: extractFenced(block) || fields['因果链'] || '',
    sentiment,
    sentimentClass: classifySentiment(sentiment),
    duration: fields['影响持续时间'] || fields['持续时间'] || '',
    confidence: fields['置信度'] || '',
    rest: stripKnownFields(block).trim(),
  }
}

function extractBulletFields(block: string) {
  const output: Record<string, string> = {}
  const regex = /^\s*-?\s*\*\*([^*]+?)\*\*\s*[:：]\s*(.+?)\s*$/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(block)) !== null) {
    const key = match[1].trim()
    if (!output[key]) output[key] = match[2].trim()
  }
  return output
}

function extractFenced(block: string) {
  return block.match(/```[\w]*\n([\s\S]*?)```/)?.[1]?.trim() || ''
}

const knownEventFields = [
  '事件名称', '事件类型',
  '直接受益/受损方', '直接受益方', '直接受损方',
  '因果链', '情绪方向', '情绪',
  '影响持续时间', '持续时间', '置信度',
]

function stripKnownFields(block: string) {
  const regex = new RegExp(`^\\s*-?\\s*\\*\\*(${knownEventFields.join('|')})\\*\\*\\s*[:：].*$`, 'gm')
  return block.replace(regex, '').replace(/```[\s\S]*?```/g, '').trim()
}

function parseMatrix(body: string) {
  if (!body) return { headers: [], rows: [] }
  const tableLines = extractTableBlock(body)
  if (tableLines.length < 2) return { headers: [], rows: [] }
  const headers = splitRow(tableLines[0])
  const rows: Record<string, string>[] = []
  for (let index = 2; index < tableLines.length; index += 1) {
    const cells = splitRow(tableLines[index])
    if (!cells.length) continue
    const row: Record<string, string> = {}
    headers.forEach((header, cellIndex) => {
      row[header] = (cells[cellIndex] || '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

function parseSectorMatrix(body: string) {
  const matrix = parseMatrix(body)
  return {
    headers: matrix.headers,
    rows: matrix.rows.map((row) => ({
      name: row['板块'] || row[matrix.headers[0]] || '',
      direction: row['影响方向'] || row[matrix.headers[1]] || '',
      logic: row['逻辑'] || row[matrix.headers[2]] || '',
      strength: row['强度'] || row[matrix.headers[3]] || '',
    })),
  }
}

function extractTableBlock(body: string) {
  const lines: string[] = []
  let inTable = false
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    const isPipeLine = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|', 1)
    if (isPipeLine) {
      inTable = true
      lines.push(trimmed)
    } else if (inTable) {
      break
    }
  }
  return lines
}

function splitRow(row: string) {
  return row.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function classifySentiment(sentiment: string): EventItem['sentimentClass'] {
  if (!sentiment) return 'secondary'
  if (/正面|利好|看多|bullish|positive/i.test(sentiment)) return 'success'
  if (/负面|利空|看空|bearish|negative/i.test(sentiment)) return 'error'
  if (/中性|neutral/i.test(sentiment)) return 'warning'
  return 'secondary'
}

function classifyDirection(direction: string) {
  if (/↑|受益|上涨|看多|positive/i.test(direction)) return 'up'
  if (/↓|受损|下跌|看空|negative/i.test(direction)) return 'down'
  return 'flat'
}

function parseChain(text: string) {
  if (!text) return []
  return text
    .replace(/```/g, '')
    .trim()
    .split(/\n\s*[↓→]\s*\n|\n\s*-+>\s*\n|\s*→\s*|\s*->\s*|\n\s*↓\s*/g)
    .map((part) => part.replace(/^[\[(]|[\])]$/g, '').trim())
    .filter(Boolean)
}
