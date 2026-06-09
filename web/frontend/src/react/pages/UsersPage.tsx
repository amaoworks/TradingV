import { Badge, Button, Input, Label, Table } from '@cloudflare/kumo'
import { MagnifyingGlass, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { PageHeader, SectionCard } from '../components/Page'
import api from '../lib/api'

type Role = 'admin' | 'member' | 'viewer'

interface User {
  id: string
  username: string
  email: string
  role: Role
  active: boolean
  lastLogin: string
}

interface UserForm {
  username: string
  email: string
  password: string
  role: Role
}

const AVATAR_COLORS = ['#f48120', '#2e7df5', '#22c55e', '#a855f7', '#ef4444']

const BLANK_FORM: UserForm = { username: '', email: '', password: '', role: 'member' }

function avatarColor(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function UsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(BLANK_FORM)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items: User[] }>('/api/users')
      setUsers(data.items)
    } catch {
      setError(t('login.networkError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [users, search])

  const openAddDialog = useCallback(() => {
    setEditingUser(null)
    setForm(BLANK_FORM)
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((user: User) => {
    setEditingUser(user)
    setForm({ username: user.username, email: user.email, password: '', role: user.role })
    setDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((user: User) => {
    setDeletingUser(user)
    setDeleteDialogOpen(true)
  }, [])

  const toggleStatus = useCallback(async (user: User) => {
    setError('')
    try {
      const { data } = await api.put<User>(`/api/users/${user.id}`, { active: !user.active })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data : u)))
    } catch {
      setError(t('login.networkError'))
    }
  }, [t])

  const handleSave = useCallback(async () => {
    if (!form.username.trim() || !form.email.trim()) return
    if (!editingUser && !form.password.trim()) return

    setSaving(true)
    setError('')
    try {
      if (editingUser) {
        const { data } = await api.put<User>(`/api/users/${editingUser.id}`, {
          username: form.username,
          email: form.email,
          role: form.role,
        })
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data : u)))
      } else {
        const { data } = await api.post<User>('/api/users', {
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
          active: true,
        })
        setUsers((prev) => [...prev, data])
      }
      setDialogOpen(false)
    } catch {
      setError(t('login.networkError'))
    } finally {
      setSaving(false)
    }
  }, [editingUser, form, t])

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return
    setSaving(true)
    setError('')
    try {
      await api.delete(`/api/users/${deletingUser.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id))
      setDeleteDialogOpen(false)
      setDeletingUser(null)
    } catch {
      setError(t('login.networkError'))
    } finally {
      setSaving(false)
    }
  }, [deletingUser, t])

  const roleBadgeVariant = (role: Role) => {
    if (role === 'admin') return 'warning' as const
    if (role === 'member') return 'success' as const
    return 'neutral' as const
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle')}
        actions={
          <Button icon={Plus} onClick={openAddDialog}>
            {t('users.addUser')}
          </Button>
        }
      />

      <SectionCard>
        <div className="users-search-wrap">
          <MagnifyingGlass size={16} className="users-search-icon" />
          <Input
            placeholder={t('users.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
      </SectionCard>

      {error && (
        <div className="auth-error" role="alert">{error}</div>
      )}

      <SectionCard>
        <div className="kumo-table-wrap">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t('users.username')}</Table.Head>
                <Table.Head>{t('users.email')}</Table.Head>
                <Table.Head>{t('users.role')}</Table.Head>
                <Table.Head>{t('users.status')}</Table.Head>
                <Table.Head>{t('users.lastLogin')}</Table.Head>
                <Table.Head>{t('common.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(loading ? [] : filteredUsers).map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <div className="users-user-cell">
                      <span
                        className="users-avatar"
                        style={{ backgroundColor: avatarColor(user.username) }}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                      <div className="users-user-info">
                        <span>{user.username}</span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{user.email}</Table.Cell>
                  <Table.Cell>
                    <Badge variant={roleBadgeVariant(user.role)}>
                      {t(`users.${user.role}`)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <button
                      type="button"
                      className="users-status-toggle"
                      onClick={() => toggleStatus(user)}
                    >
                      <span
                        className={`users-status-dot ${user.active ? 'active' : 'inactive'}`}
                      />
                      {user.active ? t('users.active') : t('users.inactive')}
                    </button>
                  </Table.Cell>
                  <Table.Cell>{user.lastLogin}</Table.Cell>
                  <Table.Cell>
                    <div className="kumo-row-actions">
                      <Button
                        size="sm"
                        icon={PencilSimple}
                        onClick={() => openEditDialog(user)}
                      />
                      <Button
                        size="sm"
                        icon={Trash}
                        variant="secondary-destructive"
                        onClick={() => openDeleteDialog(user)}
                      />
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </SectionCard>

      {/* Add / Edit User Dialog */}
      {dialogOpen && (
        <div
          className="kumo-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false)
          }}
        >
          <div className="kumo-provider-dialog" role="dialog">
            <div className="kumo-card-header">
              <h2>{editingUser ? t('users.editUser') : t('users.addUser')}</h2>
              <Button size="sm" icon={X} variant="ghost" onClick={() => setDialogOpen(false)} />
            </div>
            <div className="kumo-dialog-body">
              <div className="kumo-form-grid">
                <div>
                  <Label>{t('users.username')}</Label>
                  <Input
                    value={form.username}
                    placeholder={t('register.usernamePlaceholder')}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.currentTarget.value }))
                    }
                  />
                </div>
                <div>
                  <Label>{t('users.email')}</Label>
                  <Input
                    value={form.email}
                    placeholder={t('register.emailPlaceholder')}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.currentTarget.value }))
                    }
                  />
                </div>
                {!editingUser && (
                  <div>
                    <Label>{t('users.password')}</Label>
                    <Input
                      type="password"
                      value={form.password}
                      placeholder={t('users.passwordPlaceholder')}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.currentTarget.value }))
                      }
                    />
                  </div>
                )}
                <div>
                  <Label>{t('users.role')}</Label>
                  <select
                    className="users-role-select"
                    value={form.role}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, role: e.currentTarget.value as Role }))
                    }
                  >
                    <option value="admin">{t('users.admin')}</option>
                    <option value="member">{t('users.member')}</option>
                    <option value="viewer">{t('users.viewer')}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="kumo-dialog-actions">
              <Button variant="secondary" icon={X} onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && deletingUser && (
        <div
          className="kumo-dialog-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteDialogOpen(false)
              setDeletingUser(null)
            }
          }}
        >
          <div className="kumo-provider-dialog" role="alertdialog">
            <div className="kumo-card-header">
              <h2>{t('users.deleteUser')}</h2>
              <Button
                size="sm"
                icon={X}
                variant="ghost"
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setDeletingUser(null)
                }}
              />
            </div>
            <div className="kumo-dialog-body">
              <p>{t('users.deleteConfirmMessage')}</p>
            </div>
            <div className="kumo-dialog-actions">
              <Button
                variant="secondary"
                icon={X}
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setDeletingUser(null)
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" icon={Trash} onClick={handleDelete}>
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
