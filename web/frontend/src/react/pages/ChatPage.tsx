import { Badge, Button, Input } from '@cloudflare/kumo'
import { ChatCircle, Lightbulb, Newspaper, PaperPlaneRight, TrendUp } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PageHeader } from '../components/Page'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string
  user: string
  text: string
  time: string
}

interface ChatRoom {
  key: string
  i18nKey: string
  icon: Icon
  online: number
  messages: ChatMessage[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  '#f05365',
  '#7c3aed',
  '#2563eb',
  '#16a34a',
  '#f48120',
  '#ec4899',
  '#8b5cf6',
  '#06b6d4',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function avatarInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

let msgId = 100

function nextId(): string {
  return String(++msgId)
}

/* ------------------------------------------------------------------ */
/* Mock data                                                           */
/* ------------------------------------------------------------------ */

function buildRooms(): ChatRoom[] {
  return [
    {
      key: 'general',
      i18nKey: 'chat.general',
      icon: ChatCircle,
      online: 24,
      messages: [
        { id: '1', user: 'Admin', text: 'Welcome to TradingV! Please be respectful and follow the community guidelines.', time: '09:00' },
        { id: '2', user: 'Alice', text: 'Good morning everyone! Markets are looking interesting today.', time: '09:12' },
        { id: '3', user: 'Bob', text: 'Hey Alice! Yeah, pre-market futures are up across the board.', time: '09:15' },
        { id: '4', user: 'Charlie', text: 'Anyone keeping an eye on the Fed minutes releasing later?', time: '09:22' },
        { id: '5', user: 'Diana', text: 'Already positioned for it. Should be a volatile session.', time: '09:30' },
      ],
    },
    {
      key: 'trading',
      i18nKey: 'chat.trading',
      icon: TrendUp,
      online: 18,
      messages: [
        { id: '10', user: 'Bob', text: 'Just opened a long position on AAPL at $192.40 — targeting $198.', time: '09:45' },
        { id: '11', user: 'Diana', text: 'Bold move. Earnings are next week, could see a run-up.', time: '09:48' },
        { id: '12', user: 'Alice', text: 'I\'m watching NVDA closely. The pullback to the 50-day MA looks like a solid entry.', time: '09:55' },
        { id: '13', user: 'Charlie', text: 'Set my stop-loss at $185 for the SPY puts. Risk management is key.', time: '10:02' },
      ],
    },
    {
      key: 'strategy',
      i18nKey: 'chat.strategy',
      icon: Lightbulb,
      online: 12,
      messages: [
        { id: '20', user: 'Alice', text: 'Has anyone backtested the mean-reversion strategy on crypto pairs?', time: '10:10' },
        { id: '21', user: 'Charlie', text: 'Yes — works well on BTC/ETH in sideways markets. Sharpe ratio around 1.8.', time: '10:14' },
        { id: '22', user: 'Admin', text: 'We just added new backtesting templates in the Strategy section. Check them out!', time: '10:20' },
        { id: '23', user: 'Bob', text: 'I prefer momentum strategies with a 20/50 EMA crossover. Simple but effective.', time: '10:25' },
        { id: '24', user: 'Diana', text: 'Combining momentum with volume profile gives much better signals in my experience.', time: '10:30' },
      ],
    },
    {
      key: 'news',
      i18nKey: 'chat.news',
      icon: Newspaper,
      online: 31,
      messages: [
        { id: '30', user: 'Admin', text: 'Breaking: CPI data came in at 3.2%, below the expected 3.4%.', time: '08:30' },
        { id: '31', user: 'Diana', text: 'Markets rallying on the news. Treasury yields dropping fast.', time: '08:35' },
        { id: '32', user: 'Bob', text: 'Tech sector leading the move. QQQ up 1.5% already.', time: '08:40' },
      ],
    },
  ]
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatPage() {
  const { t } = useI18n()
  const [rooms, setRooms] = useState<ChatRoom[]>(buildRooms)
  const [activeRoom, setActiveRoom] = useState('general')
  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const current = rooms.find((r) => r.key === activeRoom)!

  /* auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current.messages.length])

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text) return

    setRooms((prev) =>
      prev.map((room) =>
        room.key === activeRoom
          ? {
              ...room,
              messages: [
                ...room.messages,
                {
                  id: nextId(),
                  user: 'You',
                  text,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ],
            }
          : room,
      ),
    )
    setDraft('')
  }, [activeRoom, draft])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="kumo-page-stack">
      <PageHeader title={t('chat.title')} />

      <div className="chat-layout">
        {/* ---------- Sidebar ---------- */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>{t('chat.rooms')}</h3>
          </div>

          <div className="chat-room-list">
            {rooms.map((room) => {
              const Icon = room.icon
              const isActive = room.key === activeRoom
              return (
                <button
                  key={room.key}
                  className={`chat-room-item${isActive ? ' active' : ''}`}
                  onClick={() => setActiveRoom(room.key)}
                >
                  <span className="chat-room-icon">
                    <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                  </span>
                  <span>{t(room.i18nKey)}</span>
                  {!isActive && room.messages.length > 3 && (
                    <Badge>{room.messages.length}</Badge>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* ---------- Main chat area ---------- */}
        <section className="chat-main">
          {/* Header */}
          <div className="chat-header">
            <h2>{t(current.i18nKey)}</h2>
            <span className="chat-online-badge">
              <span className="chat-online-dot" />
              {current.online} {t('chat.online')}
            </span>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            <div className="chat-date-divider">
              <span>{t('chat.today')}</span>
            </div>

            {current.messages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <div
                  className="chat-message-avatar"
                  style={{ backgroundColor: avatarColor(msg.user) }}
                >
                  {avatarInitial(msg.user)}
                </div>
                <div className="chat-message-body">
                  <div className="chat-message-meta">
                    <strong>{msg.user}</strong>
                    <span>{msg.time}</span>
                  </div>
                  <div className="chat-message-text">{msg.text}</div>
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.messagePlaceholder')}
            />
            <Button onClick={handleSend} icon={PaperPlaneRight}>
              {t('chat.send')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
