import { Badge, Button, Empty, Loader } from '@cloudflare/kumo'
import { ArrowRight } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DebateThread, type DebateRole, type DebateTurn } from '../components/DebateThread'
import { PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'

interface AgentEvent {
  type: string
  agent: string
  content: string
  stats?: { tokens?: number }
  timestamp: string
  debate?: 'invest' | 'risk'
  role?: DebateRole
  round?: number
}

export function ProgressPage() {
  const { t } = useI18n()
  const params = useParams()
  const analysisId = params.id || ''
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [debateTurns, setDebateTurns] = useState<DebateTurn[]>([])
  const [status, setStatus] = useState('connecting')
  const [finalSignal, setFinalSignal] = useState('')
  const [elapsed, setElapsed] = useState('0s')
  const startTimeRef = useRef(Date.now())
  const outputRef = useRef<HTMLDivElement | null>(null)
  const debateRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!analysisId) return undefined
    const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/analyze/${analysisId}`
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => setStatus('running')
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as AgentEvent
      setEvents((current) => [...current, event])

      if (event.type === 'debate_turn' && event.role && event.round != null) {
        setDebateTurns((current) => [
          ...current.map((turn) => ({ ...turn, live: false })),
          {
            role: event.role as DebateRole,
            round: event.round || 1,
            content: event.content || '',
            live: true,
          },
        ])
      } else if (event.type === 'analysis_complete') {
        setStatus('complete')
        setFinalSignal(event.content || '')
        setDebateTurns((current) => current.map((turn) => ({ ...turn, live: false })))
      } else if (event.type === 'error') {
        setStatus('error')
      }
    }
    socket.onclose = () => {
      setStatus((current) => (current === 'running' ? 'disconnected' : current))
    }

    return () => socket.close()
  }, [analysisId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(`${Math.round((Date.now() - startTimeRef.current) / 1000)}s`)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
    if (debateRef.current) debateRef.current.scrollTop = debateRef.current.scrollHeight
  }, [debateTurns, events])

  const timelineEvents = useMemo(
    () => events.filter((event) => event.type !== 'debate_turn'),
    [events],
  )
  const liveOutput = timelineEvents.map((event) => `[${event.agent || event.type}] ${event.content}`).join('\n')
  const active = status === 'running' || status === 'connecting'

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('progress.title')}
        subtitle={analysisId}
        actions={<Badge variant={statusVariant(status)}>{status}</Badge>}
      />

      <div className="kumo-two-column">
        <div className="kumo-page-stack">
          <SectionCard title={t('progress.agents')}>
            {timelineEvents.length ? (
              <div className="kumo-timeline">
                {timelineEvents.map((event, index) => (
                  <article key={`${event.timestamp}-${index}`} className={`type-${event.type}`}>
                    <div>
                      <strong>{event.agent || event.type}</strong>
                      <span>{formatTime(event.timestamp)}</span>
                    </div>
                    <p>{truncate(event.content || '')}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                size="sm"
                title={t('progress.waitingStart')}
                contents={active ? <Loader size="sm" aria-label={t('progress.waitingStart')} /> : null}
              />
            )}
          </SectionCard>

          <SectionCard title={t('progress.stats')}>
            <div className="kumo-stat-grid">
              <Stat label={t('progress.events')} value={events.length} />
              <Stat label={t('progress.debateTurns')} value={debateTurns.length} />
              <Stat label={t('progress.elapsed')} value={elapsed} />
            </div>
          </SectionCard>
        </div>

        <div className="kumo-page-stack">
          <SectionCard title={t('progress.liveDebate')}>
            <div ref={debateRef} className="kumo-scroll-panel kumo-debate-scroll">
              {debateTurns.length ? (
                <DebateThread turns={debateTurns} emptyText={t('progress.waitingDebate')} />
              ) : (
                <div className="kumo-waiting-row">
                  <Loader size="sm" aria-label={t('progress.waitingBullBear')} />
                  <span>{t('progress.waitingBullBear')}</span>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title={t('progress.liveOutput')}>
            <div ref={outputRef} className="kumo-scroll-panel kumo-output-panel">
              {liveOutput || t('progress.waitingStart')}
            </div>
          </SectionCard>
        </div>
      </div>

      {finalSignal ? (
        <SectionCard title={t('progress.finalDecision')}>
          <div className="kumo-final-decision">
            <h2>{finalSignal}</h2>
            <Link to={`/report/${analysisId}`} className="kumo-link-reset">
              <Button>
                {t('progress.viewReport')}
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kumo-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function statusVariant(status: string) {
  if (status === 'complete') return 'success'
  if (status === 'error' || status === 'failed') return 'error'
  if (status === 'disconnected') return 'warning'
  return 'info'
}

function formatTime(timestamp: string) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString()
}

function truncate(text: string) {
  return text.length > 220 ? `${text.slice(0, 220)}...` : text
}
