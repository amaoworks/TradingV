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
import { Play, Plus } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage } from '../lib/format'

interface Schedule {
  id: number
  name: string | null
  ticker: string
  asset_type: string
  schedule_type: 'interval' | 'daily' | 'weekly'
  interval_minutes: number | null
  time_of_day: string | null
  day_of_week: number | null
  analysts: string
  config_json: string
  status: 'active' | 'paused' | 'disabled'
  fail_count: number
  last_run_at: string | null
  last_analysis_id: string | null
  next_run_at: string
  from_holding: number
}

interface ScheduleForm {
  name: string
  ticker: string
  asset_type: string
  schedule_type: 'interval' | 'daily' | 'weekly'
  interval_minutes: number
  time_of_day: string
  day_of_week: number
  analysts: string[]
  max_debate_rounds: number
  max_risk_discuss_rounds: number
}

const defaultForm: ScheduleForm = {
  name: '',
  ticker: '',
  asset_type: 'stock',
  schedule_type: 'daily',
  interval_minutes: 60,
  time_of_day: '09:30',
  day_of_week: 0,
  analysts: ['market', 'news', 'fundamentals'],
  max_debate_rounds: 1,
  max_risk_discuss_rounds: 1,
}

const analystValues = ['market', 'news', 'fundamentals', 'social', 'cn_social', 'event']
const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function SchedulePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ScheduleForm>(defaultForm)

  const dayItems = useMemo(
    () => dayKeys.map((key, index) => ({ label: t(`schedule.days.${key}`), value: index })),
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get<{ items?: Schedule[] }>('/api/schedules')
      setSchedules(data.items || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setForm(defaultForm)
    setDialogOpen(true)
  }

  function update<K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function describePattern(schedule: Schedule) {
    if (schedule.schedule_type === 'interval') {
      return t('schedule.pattern.interval', { n: schedule.interval_minutes || 0 })
    }
    if (schedule.schedule_type === 'daily') {
      return t('schedule.pattern.daily', { time: schedule.time_of_day || '-' })
    }
    const dow = dayItems.find((day) => day.value === schedule.day_of_week)?.label || ''
    return t('schedule.pattern.weekly', { dow, time: schedule.time_of_day || '-' })
  }

  async function save() {
    if (!form.ticker.trim()) {
      setError(t('schedule.validation.ticker'))
      return
    }
    if (form.schedule_type === 'interval' && form.interval_minutes < 5) {
      setError(t('schedule.validation.intervalMin'))
      return
    }
    if (form.schedule_type !== 'interval' && !form.time_of_day) {
      setError(t('schedule.validation.timeOfDay'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.post('/api/schedules', {
        name: form.name || null,
        ticker: form.ticker.trim().toUpperCase(),
        asset_type: form.asset_type,
        schedule_type: form.schedule_type,
        interval_minutes: form.schedule_type === 'interval' ? form.interval_minutes : null,
        time_of_day: form.schedule_type !== 'interval' ? form.time_of_day : null,
        day_of_week: form.schedule_type === 'weekly' ? form.day_of_week : null,
        analysts: form.analysts,
        max_debate_rounds: form.max_debate_rounds,
        max_risk_discuss_rounds: form.max_risk_discuss_rounds,
      })
      setDialogOpen(false)
      await load()
    } catch (err) {
      setError(`${t('schedule.msg.saveFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setSaving(false)
    }
  }

  async function triggerNow(schedule: Schedule) {
    setError('')
    try {
      const { data } = await api.post<{ analysis_id?: string }>(`/api/schedules/${schedule.id}/trigger`)
      if (data.analysis_id) navigate(`/progress/${data.analysis_id}`)
    } catch (err) {
      setError(`${t('schedule.msg.triggerFailed')}${errorMessage(err, t('common.unknownError'))}`)
    }
  }

  async function setStatus(schedule: Schedule, status: 'active' | 'paused') {
    setError('')
    try {
      await api.put(`/api/schedules/${schedule.id}`, { status })
      await load()
    } catch (err) {
      setError(`${t('schedule.msg.actionFailed')}${errorMessage(err, t('common.unknownError'))}`)
    }
  }

  async function deleteSchedule(schedule: Schedule) {
    if (!window.confirm(t('schedule.confirmDeleteContent', { name: schedule.name || schedule.ticker }))) return
    await api.delete(`/api/schedules/${schedule.id}`)
    await load()
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('schedule.title')}
        subtitle={t('schedule.subtitle')}
        actions={
          <Button onClick={openCreate}>
            <Plus size={16} />
            {t('schedule.newTask')}
          </Button>
        }
      />
      <Banner variant="secondary" title={t('schedule.info')} />
      <ErrorBanner message={error} />

      <SectionCard>
        {schedules.length ? (
          <KumoTable>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t('schedule.cols.name')}</Table.Head>
                <Table.Head>{t('schedule.cols.ticker')}</Table.Head>
                <Table.Head>{t('schedule.cols.trigger')}</Table.Head>
                <Table.Head>{t('schedule.cols.analysts')}</Table.Head>
                <Table.Head>{t('schedule.cols.status')}</Table.Head>
                <Table.Head>{t('schedule.cols.nextRun')}</Table.Head>
                <Table.Head>{t('schedule.cols.lastRun')}</Table.Head>
                <Table.Head>{t('schedule.cols.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {schedules.map((schedule) => (
                <Table.Row key={schedule.id}>
                  <Table.Cell>{schedule.name || schedule.ticker}</Table.Cell>
                  <Table.Cell>{schedule.ticker}</Table.Cell>
                  <Table.Cell>{describePattern(schedule)}</Table.Cell>
                  <Table.Cell>{parseAnalysts(schedule.analysts).join(', ') || '-'}</Table.Cell>
                  <Table.Cell>
                    <div className="kumo-row-actions">
                      <Badge variant={statusVariant(schedule.status)}>
                        {t(`schedule.status.${schedule.status}`)}
                      </Badge>
                      {schedule.fail_count > 0 && schedule.status === 'active' ? (
                        <span className="kumo-muted-text">{t('schedule.failCount', { n: schedule.fail_count })}</span>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>{formatDate(schedule.next_run_at)}</Table.Cell>
                  <Table.Cell>{formatDate(schedule.last_run_at)}</Table.Cell>
                  <Table.Cell>
                    <div className="kumo-row-actions">
                      <Button size="sm" onClick={() => triggerNow(schedule)}>
                        <Play size={14} />
                        {t('schedule.btn.runNow')}
                      </Button>
                      {schedule.last_analysis_id ? (
                        <Link to={`/report/${schedule.last_analysis_id}`} className="kumo-link-reset">
                          <Button size="sm">{t('schedule.btn.viewLatest')}</Button>
                        </Link>
                      ) : null}
                      {schedule.status === 'active' ? (
                        <Button size="sm" onClick={() => setStatus(schedule, 'paused')}>
                          {t('schedule.btn.pause')}
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setStatus(schedule, 'active')}>
                          {t('schedule.btn.enable')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary-destructive"
                        onClick={() => deleteSchedule(schedule)}
                      >
                        {t('schedule.btn.delete')}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </KumoTable>
        ) : (
          <LoadingEmpty loading={loading} title={t('schedule.empty')} />
        )}
      </SectionCard>

      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog size="lg">
          <Dialog.Title>{t('schedule.createTitle')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Input
              label={t('schedule.fields.name')}
              value={form.name}
              placeholder={t('schedule.fields.namePlaceholder')}
              onChange={(event) => update('name', event.currentTarget.value)}
            />
            <Input
              label={t('common.ticker')}
              value={form.ticker}
              placeholder={t('schedule.fields.tickerPlaceholder')}
              onChange={(event) => update('ticker', event.currentTarget.value.toUpperCase())}
            />
            <Radio.Group
              legend={t('schedule.fields.assetType')}
              orientation="horizontal"
              value={form.asset_type}
              onValueChange={(value) => update('asset_type', value)}
            >
              <Radio.Item value="stock" label={t('common.stock')} />
              <Radio.Item value="crypto" label={t('common.crypto')} />
            </Radio.Group>
            <Radio.Group
              legend={t('schedule.fields.triggerType')}
              orientation="horizontal"
              value={form.schedule_type}
              onValueChange={(value) => update('schedule_type', value as ScheduleForm['schedule_type'])}
            >
              <Radio.Item value="interval" label={t('schedule.triggerTypes.interval')} />
              <Radio.Item value="daily" label={t('schedule.triggerTypes.daily')} />
              <Radio.Item value="weekly" label={t('schedule.triggerTypes.weekly')} />
            </Radio.Group>
            {form.schedule_type === 'interval' ? (
              <Input
                type="number"
                min={5}
                step={5}
                label={t('schedule.fields.intervalMinutes')}
                value={form.interval_minutes}
                placeholder={t('schedule.fields.intervalPlaceholder')}
                onChange={(event) => update('interval_minutes', Number(event.currentTarget.value))}
              />
            ) : (
              <Input
                type="time"
                label={t('schedule.fields.timeOfDay')}
                value={form.time_of_day}
                onChange={(event) => update('time_of_day', event.currentTarget.value)}
              />
            )}
            {form.schedule_type === 'weekly' ? (
              <Select
                label={t('schedule.fields.dayOfWeek')}
                value={form.day_of_week}
                items={dayItems}
                placeholder={t('schedule.fields.dowPlaceholder')}
                onValueChange={(value) => update('day_of_week', Number(value))}
              />
            ) : null}
            <Checkbox.Group
              legend={t('schedule.fields.enableAnalysts')}
              value={form.analysts}
              allValues={analystValues}
              onValueChange={(value) => update('analysts', value)}
            >
              <Checkbox.Item value="market" label={t('holdings.schedule.analystMarket')} />
              <Checkbox.Item value="news" label={t('holdings.schedule.analystNews')} />
              <Checkbox.Item value="fundamentals" label={t('holdings.schedule.analystFundamentals')} />
              <Checkbox.Item value="social" label={t('holdings.schedule.analystSocial')} />
              <Checkbox.Item value="cn_social" label={t('holdings.schedule.analystCnSocial')} />
              <Checkbox.Item value="event" label={t('holdings.schedule.analystEvent')} />
            </Checkbox.Group>
            <div className="kumo-form-grid compact">
              <Input
                type="number"
                min={1}
                max={3}
                label={t('schedule.fields.researchDebate')}
                value={form.max_debate_rounds}
                onChange={(event) => update('max_debate_rounds', Number(event.currentTarget.value))}
              />
              <Input
                type="number"
                min={1}
                max={3}
                label={t('schedule.fields.riskDebate')}
                value={form.max_risk_discuss_rounds}
                onChange={(event) => update('max_risk_discuss_rounds', Number(event.currentTarget.value))}
              />
            </div>
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button {...props}>{t('common.cancel')}</Button>} />
            <Button loading={saving} onClick={save}>{t('common.save')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function parseAnalysts(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function statusVariant(status: Schedule['status']) {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  return 'error'
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}
