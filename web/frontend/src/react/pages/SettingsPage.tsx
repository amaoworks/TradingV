import {
  Badge,
  Banner,
  Button,
  Dialog,
  Input,
  Select,
  SensitiveInput,
  Switch,
  Table,
} from '@cloudflare/kumo'
import { Check, FloppyDisk, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { ModelPicker } from '../components/ModelPicker'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage } from '../lib/format'
import {
  fetchModelCatalog,
  fetchProviderConnections,
  fetchSettings,
  updateSettings,
} from '../lib/settings'
import type { ModelCatalog, ProviderConnection, ProviderOption, Settings } from '../lib/types'

const blankSettings: Settings = {
  llm_provider: '',
  deep_think_llm: '',
  quick_think_llm: '',
  backend_url: '',
  max_debate_rounds: 1,
  max_risk_discuss_rounds: 1,
  output_language: 'Chinese',
  checkpoint_enabled: false,
  benchmark_ticker: '',
  data_cache_dir: '',
  results_dir: '',
  memory_log_path: '',
}

interface ProviderForm {
  provider: string
  base_url: string
  api_key: string
}

export function SettingsPage() {
  const { t } = useI18n()
  const [settings, setSettings] = useState<Settings>(blankSettings)
  const [catalog, setCatalog] = useState<ModelCatalog>({})
  const [providers, setProviders] = useState<ProviderConnection[]>([])
  const [choices, setChoices] = useState<ProviderOption[]>([])
  const [providerForm, setProviderForm] = useState<ProviderForm>({
    provider: '',
    base_url: '',
    api_key: '',
  })
  const [editingProvider, setEditingProvider] = useState('')
  const [providerDialogOpen, setProviderDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const configuredProviderItems = providers.map((row) => ({
    label: row.label,
    value: row.provider,
  }))
  const allProviderItems = choices.map((row) => ({ label: row.label, value: row.provider }))
  const selectedChoice = choices.find((row) => row.provider === providerForm.provider)
  const selectedExisting = providers.find((row) => row.provider === providerForm.provider)
  const deepModelOptions = catalog[settings.llm_provider.toLowerCase()]?.deep || []
  const quickModelOptions = catalog[settings.llm_provider.toLowerCase()]?.quick || []
  const apiKeyPlaceholder = useMemo(() => {
    if (!selectedChoice?.required) return t('settings.placeholderNoNeed')
    return selectedExisting?.set
      ? t('settings.placeholderSet', { masked: selectedExisting.masked })
      : t('settings.placeholderUnset')
  }, [selectedChoice, selectedExisting, t])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [nextSettings, nextCatalog, nextProviders] = await Promise.all([
        fetchSettings(),
        fetchModelCatalog(),
        fetchProviderConnections(),
      ])
      setCatalog(nextCatalog)
      setProviders(nextProviders.providers)
      setChoices(nextProviders.available)
      const activeProvider =
        nextProviders.providers.some((row) => row.provider === nextSettings.llm_provider)
          ? nextSettings.llm_provider
          : nextProviders.providers[0]?.provider || ''
      setSettings({
        ...blankSettings,
        ...nextSettings,
        llm_provider: activeProvider,
        deep_think_llm: activeProvider ? nextSettings.deep_think_llm || '' : '',
        quick_think_llm: activeProvider ? nextSettings.quick_think_llm || '' : '',
        backend_url: activeProvider ? nextSettings.backend_url || '' : '',
      })
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function openProviderModal(provider?: string) {
    const target = providers.find((row) => row.provider === provider)
    const choice = choices.find((row) => row.provider === (provider || choices[0]?.provider))
    setEditingProvider(provider || '')
    setProviderForm({
      provider: provider || choice?.provider || '',
      base_url: target?.base_url || choice?.default_base_url || '',
      api_key: '',
    })
    setProviderDialogOpen(true)
  }

  function updateProviderSelection(provider: string) {
    const choice = choices.find((row) => row.provider === provider)
    const existing = providers.find((row) => row.provider === provider)
    setProviderForm({
      provider,
      base_url: existing?.base_url || choice?.default_base_url || '',
      api_key: '',
    })
  }

  async function saveProviderConnection() {
    if (!providerForm.provider) return
    if (selectedChoice?.required && !selectedExisting?.set && !providerForm.api_key.trim()) {
      setError(t('settings.keyMsg.nothing'))
      return
    }
    setSavingProvider(true)
    setError('')
    try {
      const payload: Record<string, string> = {
        provider: providerForm.provider,
        base_url: providerForm.base_url,
      }
      if (providerForm.api_key.trim()) payload.api_key = providerForm.api_key.trim()
      await api.put('/api/provider-connections', payload)
      const next = await fetchProviderConnections()
      setProviders(next.providers)
      setChoices(next.available)
      setSettings((current) => ({
        ...current,
        llm_provider: current.llm_provider || providerForm.provider,
        backend_url: providerForm.base_url,
      }))
      setProviderDialogOpen(false)
    } catch (err) {
      setError(`${t('settings.keyMsg.saveFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setSavingProvider(false)
    }
  }

  async function deleteProviderConnection(provider: string) {
    if (!window.confirm(t('settings.providerDeleted'))) return
    await api.delete(`/api/provider-connections/${provider}`)
    const next = await fetchProviderConnections()
    setProviders(next.providers)
    setChoices(next.available)
    if (settings.llm_provider === provider) {
      const replacement = next.providers[0]
      setSettings((current) => ({
        ...current,
        llm_provider: replacement?.provider || '',
        deep_think_llm: '',
        quick_think_llm: '',
        backend_url: replacement?.base_url || '',
      }))
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload: Partial<Settings> = { ...settings }
      if (!payload.llm_provider) {
        delete payload.llm_provider
        delete payload.backend_url
      }
      const next = await updateSettings(payload)
      const activeProvider =
        providers.some((row) => row.provider === next.llm_provider)
          ? next.llm_provider
          : providers[0]?.provider || ''
      setSettings({
        ...blankSettings,
        ...next,
        llm_provider: activeProvider,
        deep_think_llm: activeProvider ? next.deep_think_llm || '' : '',
        quick_think_llm: activeProvider ? next.quick_think_llm || '' : '',
        backend_url: activeProvider ? next.backend_url || '' : '',
      })
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <ErrorBanner message={error} />

      <SectionCard title={t('settings.llmCard')}>
        {loading ? (
          <LoadingEmpty loading title={t('common.empty')} />
        ) : !providers.length ? (
          <div className="kumo-settings-empty">
            <p>{t('settings.providerPlaceholder')}</p>
            <Button size="sm" icon={Plus} onClick={() => openProviderModal()}>{t('settings.addProvider')}</Button>
          </div>
        ) : (
          <div className="kumo-form-grid kumo-settings-llm-grid">
            <div className="kumo-settings-provider-field">
              <Select
                label={t('settings.provider')}
                value={settings.llm_provider}
                items={configuredProviderItems}
                placeholder={t('settings.providerPlaceholder')}
                onValueChange={(value) => {
                  const provider = String(value || '')
                  const row = providers.find((item) => item.provider === provider)
                  setSettings((current) => ({
                    ...current,
                    llm_provider: provider,
                    backend_url: row?.base_url || '',
                  }))
                }}
              />
            </div>
            <ModelPicker
              label={t('settings.deepModel')}
              value={settings.deep_think_llm}
              options={deepModelOptions}
              placeholder={t('settings.deepPlaceholder')}
              onChange={(value) => update('deep_think_llm', value)}
            />
            <ModelPicker
              label={t('settings.quickModel')}
              value={settings.quick_think_llm}
              options={quickModelOptions}
              placeholder={t('settings.quickPlaceholder')}
              onChange={(value) => update('quick_think_llm', value)}
            />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t('settings.apiKeysCard')}
        extra={<Button size="sm" icon={Plus} onClick={() => openProviderModal()}>{t('settings.addProvider')}</Button>}
      >
        <Banner variant="secondary" title={t('settings.apiKeysInfo')} />
        {providers.length ? (
          <KumoTable>
            <Table.Header>
              <Table.Row>
                <Table.Head>{t('settings.provider')}</Table.Head>
                <Table.Head>{t('settings.apiKey')}</Table.Head>
                <Table.Head>{t('settings.apiBaseUrl')}</Table.Head>
                <Table.Head>{t('common.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {providers.map((provider) => (
                <Table.Row key={provider.provider}>
                  <Table.Cell>{provider.label}</Table.Cell>
                  <Table.Cell>
                    {!provider.required ? (
                      <Badge variant="secondary">{t('settings.keyNoNeed')}</Badge>
                    ) : provider.set ? (
                      <Badge variant="success">{`${t('settings.keySet')} · ${provider.masked}`}</Badge>
                    ) : (
                      <Badge variant="warning">{t('settings.keyUnset')}</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>{provider.base_url || provider.default_base_url || '-'}</Table.Cell>
                  <Table.Cell>
                    <div className="kumo-row-actions">
                      <Button size="sm" icon={PencilSimple} onClick={() => openProviderModal(provider.provider)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="sm"
                        icon={Trash}
                        variant="secondary-destructive"
                        onClick={() => deleteProviderConnection(provider.provider)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </KumoTable>
        ) : (
          <LoadingEmpty loading={loading} title={t('settings.noProviders')} />
        )}
      </SectionCard>

      <SectionCard title={t('settings.debateCard')}>
        <div className="kumo-form-grid">
          <Input
            type="number"
            min={1}
            max={10}
            label={t('settings.maxDebateRounds')}
            value={settings.max_debate_rounds}
            onChange={(event) => update('max_debate_rounds', Number(event.currentTarget.value))}
          />
          <Input
            type="number"
            min={1}
            max={5}
            label={t('settings.maxRiskRounds')}
            value={settings.max_risk_discuss_rounds}
            onChange={(event) => update('max_risk_discuss_rounds', Number(event.currentTarget.value))}
          />
        </div>
      </SectionCard>

      <SectionCard title={t('settings.miscCard')}>
        <div className="kumo-form-grid">
          <Select
            label={t('settings.outputLanguage')}
            value={settings.output_language}
            items={[
              { label: '中文', value: 'Chinese' },
              { label: 'English', value: 'English' },
              { label: '日本語', value: 'Japanese' },
            ]}
            onValueChange={(value) => update('output_language', String(value || ''))}
          />
          <Switch
            label={t('settings.checkpoint')}
            checked={settings.checkpoint_enabled}
            onCheckedChange={(checked) => update('checkpoint_enabled', checked)}
          />
          <Input
            label={t('settings.benchmarkTicker')}
            value={settings.benchmark_ticker || ''}
            placeholder={t('settings.benchmarkPlaceholder')}
            onChange={(event) => update('benchmark_ticker', event.currentTarget.value)}
          />
        </div>
      </SectionCard>

      <SectionCard title={t('settings.dirCard')}>
        <dl className="kumo-definition-list">
          <dt>{t('settings.dirCache')}</dt>
          <dd>{settings.data_cache_dir || '-'}</dd>
          <dt>{t('settings.dirResults')}</dt>
          <dd>{settings.results_dir || '-'}</dd>
          <dt>{t('settings.dirMemory')}</dt>
          <dd>{settings.memory_log_path || '-'}</dd>
        </dl>
      </SectionCard>

      <div className="kumo-form-actions">
        <Button icon={FloppyDisk} loading={saving} onClick={save}>{t('settings.saveBtn')}</Button>
      </div>

      <Dialog.Root open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <Dialog size="lg" className="kumo-provider-dialog">
          <Dialog.Title>
            {editingProvider ? t('settings.editProvider') : t('settings.addProvider')}
          </Dialog.Title>
          <div className="kumo-dialog-body kumo-provider-dialog-grid">
            <Select
              label={t('settings.provider')}
              value={providerForm.provider}
              items={allProviderItems}
              disabled={Boolean(editingProvider)}
              onValueChange={(value) => updateProviderSelection(String(value || ''))}
            />
            <div className="full-width">
              <Input
                label={t('settings.apiBaseUrl')}
                value={providerForm.base_url}
                placeholder={selectedChoice?.default_base_url || t('settings.apiBaseUrlPlaceholder')}
                onChange={(event) => setProviderForm((current) => ({ ...current, base_url: event.currentTarget.value }))}
              />
            </div>
            <div className="full-width">
              <SensitiveInput
                label={t('settings.apiKey')}
                value={providerForm.api_key}
                placeholder={apiKeyPlaceholder}
                disabled={!selectedChoice?.required}
                onChange={(event) => setProviderForm((current) => ({ ...current, api_key: event.currentTarget.value }))}
              />
            </div>
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button icon={X} {...props}>{t('common.cancel')}</Button>} />
            <Button icon={Check} loading={savingProvider} onClick={saveProviderConnection}>
              {t('common.save')}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}
