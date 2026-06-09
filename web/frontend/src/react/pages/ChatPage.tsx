import { Badge, Button, Input } from '@cloudflare/kumo'
import { ChatCircle, Lightbulb, Newspaper, PaperPlaneRight, TrendUp } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PageHeader } from '../components/Page'
import api from '../lib/api'

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

interface ChatRoomResponse {
  key: string
  i18nKey: string
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

const ROOM_ICONS: Record<string, Icon> = {
  general: ChatCircle,
  trading: TrendUp,
  strategy: Lightbulb,
  news: Newspaper,
}

function attachRoomIcon(room: ChatRoomResponse): ChatRoom {
  return {
    ...room,
    icon: ROOM_ICONS[room.key] || ChatCircle,
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ChatPage() {
  const { t } = useI18n()
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const current = rooms.find((r) => r.key === activeRoom) || rooms[0]

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items: ChatRoomResponse[] }>('/api/chat/rooms')
      const nextRooms = data.items.map(attachRoomIcon)
      setRooms(nextRooms)
      setActiveRoom((prev) => prev || nextRooms[0]?.key || '')
    } catch {
      setError(t('login.networkError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadMessages = useCallback(async (roomKey: string) => {
    try {
      const { data } = await api.get<{ items: ChatMessage[] }>(`/api/chat/rooms/${roomKey}/messages`)
      setRooms((prev) =>
        prev.map((room) =>
          room.key === roomKey ? { ...room, messages: data.items } : room,
        ),
      )
    } catch {
      setError(t('login.networkError'))
    }
  }, [t])

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  useEffect(() => {
    if (!activeRoom) return undefined
    void loadMessages(activeRoom)
    const timer = window.setInterval(() => {
      void loadMessages(activeRoom)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [activeRoom, loadMessages])

  /* auto-scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [current?.messages.length])

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !activeRoom || sending) return

    setSending(true)
    setError('')
    try {
      const { data } = await api.post<ChatMessage>(`/api/chat/rooms/${activeRoom}/messages`, { text })
      setRooms((prev) =>
        prev.map((room) =>
          room.key === activeRoom
            ? { ...room, messages: [...room.messages, data] }
            : room,
        ),
      )
      setDraft('')
    } catch {
      setError(t('login.networkError'))
    } finally {
      setSending(false)
    }
  }, [activeRoom, draft, sending, t])

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

      {error && (
        <div className="auth-error" role="alert">{error}</div>
      )}

      <div className="chat-layout">
        {/* ---------- Sidebar ---------- */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>{t('chat.rooms')}</h3>
          </div>

          <div className="chat-room-list">
            {(loading ? [] : rooms).map((room) => {
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
            <h2>{current ? t(current.i18nKey) : t('chat.rooms')}</h2>
            <span className="chat-online-badge">
              <span className="chat-online-dot" />
              {current?.online || 0} {t('chat.online')}
            </span>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            <div className="chat-date-divider">
              <span>{t('chat.today')}</span>
            </div>

            {(current?.messages || []).map((msg) => (
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
            <Button onClick={handleSend} icon={PaperPlaneRight} disabled={!current || sending}>
              {sending ? t('common.saving') : t('chat.send')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
