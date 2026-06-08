import { Badge, Empty } from '@cloudflare/kumo'
import { marked } from 'marked'
import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export type DebateRole = 'bull' | 'bear' | 'aggressive' | 'conservative' | 'neutral'

export interface DebateTurn {
  role: DebateRole
  round: number
  content: string
  live?: boolean
}

const rolePrefixes: { prefix: RegExp; role: DebateRole }[] = [
  { prefix: /^Bull Analyst\s*[:：]\s*/, role: 'bull' },
  { prefix: /^Bear Analyst\s*[:：]\s*/, role: 'bear' },
  { prefix: /^Aggressive Analyst\s*[:：]\s*/, role: 'aggressive' },
  { prefix: /^Conservative Analyst\s*[:：]\s*/, role: 'conservative' },
  { prefix: /^Neutral Analyst\s*[:：]\s*/, role: 'neutral' },
]

export function DebateThread({
  turns,
  history = '',
  bullHistory = '',
  bearHistory = '',
  emptyText,
}: {
  turns?: DebateTurn[]
  history?: string
  bullHistory?: string
  bearHistory?: string
  emptyText?: string
}) {
  const { t } = useI18n()
  const resolvedTurns = useMemo(() => {
    if (turns?.length) return turns
    if (history) return parseCombined(history)
    if (bullHistory || bearHistory) return interleaveBullBear(bullHistory, bearHistory)
    return []
  }, [bearHistory, bullHistory, history, turns])

  if (!resolvedTurns.length) {
    return <Empty size="sm" title={emptyText || t('debate.empty')} />
  }

  return (
    <div className="kumo-debate-thread">
      {resolvedTurns.map((turn, index) => (
        <div key={`${turn.role}-${turn.round}-${index}`} className={`kumo-debate-turn side-${sideOf(turn.role)}`}>
          <article className={`kumo-debate-bubble role-${turn.role}`}>
            <header>
              <Badge variant={roleBadgeVariant(turn.role)}>{t(`debate.roles.${turn.role}`)}</Badge>
              <span>{t('debate.round', { n: turn.round })}</span>
              {turn.live ? <span className="kumo-live-dot" title={t('debate.justArrived')} /> : null}
            </header>
            <div
              className="kumo-markdown"
              dangerouslySetInnerHTML={{ __html: marked(turn.content || '') as string }}
            />
          </article>
        </div>
      ))}
    </div>
  )
}

function parseCombined(text: string): DebateTurn[] {
  const parsed: DebateTurn[] = []
  let current: { role: DebateRole; lines: string[] } | null = null

  function flush() {
    if (!current) return
    const content = current.lines.join('\n').trim()
    if (content) parsed.push({ role: current.role, round: 0, content })
    current = null
  }

  for (const line of text.split('\n')) {
    const matched = matchRolePrefix(line)
    if (matched) {
      flush()
      current = { role: matched.role, lines: [matched.body] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  flush()

  const rounds: Partial<Record<DebateRole, number>> = {}
  return parsed.map((turn) => {
    rounds[turn.role] = (rounds[turn.role] || 0) + 1
    return { ...turn, round: rounds[turn.role] || 1 }
  })
}

function matchRolePrefix(line: string) {
  for (const { prefix, role } of rolePrefixes) {
    const matched = line.match(prefix)
    if (matched) return { role, body: line.slice(matched[0].length) }
  }
  return null
}

function interleaveBullBear(bull: string, bear: string) {
  const bulls = parseCombined(bull)
  const bears = parseCombined(bear)
  const output: DebateTurn[] = []
  const max = Math.max(bulls.length, bears.length)
  for (let index = 0; index < max; index += 1) {
    if (bulls[index]) output.push(bulls[index])
    if (bears[index]) output.push(bears[index])
  }
  return output
}

function sideOf(role: DebateRole) {
  return role === 'bull' || role === 'aggressive' ? 'right' : 'left'
}

function roleBadgeVariant(role: DebateRole) {
  if (role === 'bull') return 'success'
  if (role === 'bear' || role === 'aggressive') return 'error'
  if (role === 'conservative') return 'info'
  return 'warning'
}
