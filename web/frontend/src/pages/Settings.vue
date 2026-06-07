<template>
  <n-space vertical :size="24">
    <n-page-header :title="t('settings.title')" :subtitle="t('settings.subtitle')" />

    <n-spin :show="loading">
      <n-card :title="t('settings.llmCard')">
        <n-form label-placement="left" label-width="160">
          <n-form-item :label="t('settings.provider')">
            <n-select
              v-model:value="form.llm_provider"
              :options="configuredProviderOptions"
              :placeholder="t('settings.providerPlaceholder')"
              @update:value="onProviderSelect"
            />
          </n-form-item>
          <n-form-item :label="t('settings.deepModel')">
            <ModelPicker
              v-model="form.deep_think_llm"
              :options="deepModelOptions"
              :placeholder="t('settings.deepPlaceholder')"
            />
          </n-form-item>
          <n-form-item :label="t('settings.quickModel')">
            <ModelPicker
              v-model="form.quick_think_llm"
              :options="quickModelOptions"
              :placeholder="t('settings.quickPlaceholder')"
            />
          </n-form-item>
        </n-form>
      </n-card>

      <n-card :title="t('settings.apiKeysCard')" style="margin-top: 16px">
        <template #header-extra>
          <n-button size="small" type="primary" @click="openProviderModal()">
            {{ t('settings.addProvider') }}
          </n-button>
        </template>
        <n-alert type="info" :show-icon="false" style="margin-bottom: 16px">
          {{ t('settings.apiKeysInfo') }}
        </n-alert>
        <n-data-table
          :columns="providerColumns"
          :data="providerConnections"
          :bordered="false"
          size="small"
        />
        <n-empty v-if="!providerConnections.length" :description="t('settings.noProviders')" />
      </n-card>

      <n-card :title="t('settings.debateCard')" style="margin-top: 16px">
        <n-form label-placement="left" label-width="160">
          <n-form-item :label="t('settings.maxDebateRounds')">
            <n-input-number v-model:value="form.max_debate_rounds" :min="1" :max="10" />
          </n-form-item>
          <n-form-item :label="t('settings.maxRiskRounds')">
            <n-input-number v-model:value="form.max_risk_discuss_rounds" :min="1" :max="5" />
          </n-form-item>
        </n-form>
      </n-card>

      <n-card :title="t('settings.miscCard')" style="margin-top: 16px">
        <n-form label-placement="left" label-width="160">
          <n-form-item :label="t('settings.outputLanguage')">
            <n-select v-model:value="form.output_language" :options="langOptions" />
          </n-form-item>
          <n-form-item :label="t('settings.checkpoint')">
            <n-switch v-model:value="form.checkpoint_enabled" />
          </n-form-item>
          <n-form-item :label="t('settings.benchmarkTicker')">
            <n-input v-model:value="form.benchmark_ticker" :placeholder="t('settings.benchmarkPlaceholder')" />
          </n-form-item>
        </n-form>
      </n-card>

      <n-card :title="t('settings.dirCard')" style="margin-top: 16px" size="small">
        <n-descriptions :column="1" bordered>
          <n-descriptions-item :label="t('settings.dirCache')">{{ settings?.data_cache_dir }}</n-descriptions-item>
          <n-descriptions-item :label="t('settings.dirResults')">{{ settings?.results_dir }}</n-descriptions-item>
          <n-descriptions-item :label="t('settings.dirMemory')">{{ settings?.memory_log_path }}</n-descriptions-item>
        </n-descriptions>
      </n-card>

      <n-button type="primary" style="margin-top: 16px" :loading="saving" @click="save">
        {{ t('settings.saveBtn') }}
      </n-button>

      <n-modal
        v-model:show="showProviderModal"
        preset="card"
        :title="editingProvider ? t('settings.editProvider') : t('settings.addProvider')"
        style="width: 560px"
      >
        <n-form label-placement="left" label-width="120">
          <n-form-item :label="t('settings.provider')">
            <n-select
              v-model:value="providerForm.provider"
              :options="allProviderOptions"
              :disabled="!!editingProvider"
              @update:value="onProviderFormSelect"
            />
          </n-form-item>
          <n-form-item :label="t('settings.apiBaseUrl')">
            <n-input
              v-model:value="providerForm.base_url"
              :placeholder="providerBasePlaceholder"
              clearable
            />
          </n-form-item>
          <n-form-item :label="t('settings.apiKey')">
            <n-input
              v-model:value="providerForm.api_key"
              type="password"
              show-password-on="click"
              :placeholder="apiKeyPlaceholder"
              :disabled="!selectedProviderChoice?.required"
            />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="showProviderModal = false">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" :loading="savingProvider" @click="saveProviderConnection">
              {{ t('common.save') }}
            </n-button>
          </n-space>
        </template>
      </n-modal>
    </n-spin>
  </n-space>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { NButton, NSpace, NTag, useMessage } from 'naive-ui'
import api from '../api'
import ModelPicker from '../components/ModelPicker.vue'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const message = useMessage()
const loading = ref(true)
const saving = ref(false)
const savingProvider = ref(false)
const showProviderModal = ref(false)
const editingProvider = ref<string | null>(null)
const settings = computed(() => settingsStore.settings)

const form = reactive({
  llm_provider: '',
  deep_think_llm: '',
  quick_think_llm: '',
  backend_url: '',
  max_debate_rounds: 1,
  max_risk_discuss_rounds: 1,
  output_language: 'Chinese',
  checkpoint_enabled: false,
  benchmark_ticker: '',
})

const langOptions = [
  { label: '中文', value: 'Chinese' },
  { label: 'English', value: 'English' },
  { label: '日本語', value: 'Japanese' },
]

// --- Model catalog (loaded from backend; per-provider quick/deep options) -

const modelCatalog = computed(() => settingsStore.modelCatalog)

const deepModelOptions = computed(() => {
  const p = (form.llm_provider || '').toLowerCase()
  return modelCatalog.value[p]?.deep || []
})

const quickModelOptions = computed(() => {
  const p = (form.llm_provider || '').toLowerCase()
  return modelCatalog.value[p]?.quick || []
})

// --- Provider connections ------------------------------------------------

const providerConnections = computed(() => settingsStore.providerConnections)
const configuredProviderOptions = computed(() =>
  providerConnections.value.map(row => ({ label: row.label, value: row.provider })),
)
const allProviderOptions = computed(() =>
  settingsStore.providerChoices.map(row => ({ label: row.label, value: row.provider })),
)

const providerForm = reactive({
  provider: '',
  api_key: '',
  base_url: '',
})

const selectedProviderChoice = computed(() =>
  settingsStore.providerChoices.find(row => row.provider === providerForm.provider),
)

const providerBasePlaceholder = computed(() =>
  selectedProviderChoice.value?.default_base_url || t('settings.apiBaseUrlPlaceholder'),
)

const apiKeyPlaceholder = computed(() => {
  if (!selectedProviderChoice.value?.required) return t('settings.placeholderNoNeed')
  const existing = providerConnections.value.find(row => row.provider === providerForm.provider)
  return existing?.set
    ? t('settings.placeholderSet', { masked: existing.masked })
    : t('settings.placeholderUnset')
})

const providerColumns = computed(() => [
  { title: t('settings.provider'), key: 'label', width: 150 },
  {
    title: t('settings.apiKey'),
    key: 'api_key',
    width: 170,
    render(row: any) {
      if (!row.required) return h(NTag, { size: 'small', bordered: false }, () => t('settings.keyNoNeed'))
      if (row.set) return h(NTag, { size: 'small', type: 'success', bordered: false }, () => `${t('settings.keySet')} · ${row.masked}`)
      return h(NTag, { size: 'small', bordered: false }, () => t('settings.keyUnset'))
    },
  },
  {
    title: t('settings.apiBaseUrl'),
    key: 'base_url',
    ellipsis: { tooltip: true },
    render(row: any) {
      return row.base_url || row.default_base_url || '-'
    },
  },
  {
    title: t('common.actions'),
    key: 'actions',
    width: 150,
    render(row: any) {
      return h(NSpace, { size: 6 }, () => [
        h(NButton, { size: 'tiny', onClick: () => openProviderModal(row.provider) }, () => t('common.edit')),
        h(NButton, { size: 'tiny', type: 'error', onClick: () => deleteProviderConnection(row.provider) }, () => t('common.delete')),
      ])
    },
  },
])

function onProviderSelect(provider: string | null) {
  const row = providerConnections.value.find(item => item.provider === provider)
  form.backend_url = row?.base_url || ''
}

function onProviderFormSelect(provider: string) {
  const choice = settingsStore.providerChoices.find(row => row.provider === provider)
  const existing = providerConnections.value.find(row => row.provider === provider)
  providerForm.base_url = existing?.base_url || choice?.default_base_url || ''
  providerForm.api_key = ''
}

function openProviderModal(provider?: string) {
  editingProvider.value = provider || null
  const target = providerConnections.value.find(row => row.provider === provider)
  const choice = settingsStore.providerChoices.find(row => row.provider === (provider || settingsStore.providerChoices[0]?.provider))
  providerForm.provider = provider || (choice?.provider || '')
  providerForm.base_url = target?.base_url || choice?.default_base_url || ''
  providerForm.api_key = ''
  if (!provider && providerForm.provider) onProviderFormSelect(providerForm.provider)
  showProviderModal.value = true
}

async function saveProviderConnection() {
  if (!providerForm.provider) return
  const selected = settingsStore.providerChoices.find(row => row.provider === providerForm.provider)
  const existing = providerConnections.value.find(row => row.provider === providerForm.provider)
  if (selected?.required && !existing?.set && !providerForm.api_key.trim()) {
    message.warning(t('settings.keyMsg.nothing'))
    return
  }
  savingProvider.value = true
  try {
    const payload: Record<string, string> = {
      provider: providerForm.provider,
      base_url: providerForm.base_url,
    }
    if (providerForm.api_key.trim()) payload.api_key = providerForm.api_key.trim()
    await api.put('/api/provider-connections', payload)
    await settingsStore.fetchProviderConnections()
    if (!form.llm_provider || form.llm_provider === providerForm.provider) {
      form.llm_provider = providerForm.provider
      onProviderSelect(providerForm.provider)
    }
    showProviderModal.value = false
    message.success(t('settings.providerSaved'))
  } catch (e: any) {
    message.error(t('settings.keyMsg.saveFailed') + (e?.response?.data?.detail || e?.message || t('common.unknownError')))
  } finally {
    savingProvider.value = false
  }
}

async function deleteProviderConnection(provider: string) {
  await api.delete(`/api/provider-connections/${provider}`)
  await settingsStore.fetchProviderConnections()
  if (form.llm_provider === provider) {
    const first = providerConnections.value[0]
    form.llm_provider = first?.provider || ''
    form.backend_url = first?.base_url || ''
  }
  message.success(t('settings.providerDeleted'))
}

// --- Lifecycle ----------------------------------------------------------

async function load() {
  loading.value = true
  await Promise.all([
    settingsStore.fetch(),
    settingsStore.fetchModelCatalog(),
    settingsStore.fetchProviderConnections(),
  ])
  if (settingsStore.settings) {
    Object.assign(form, settingsStore.settings)
  }
  if (!configuredProviderOptions.value.some(row => row.value === form.llm_provider)) {
    form.llm_provider = configuredProviderOptions.value[0]?.value || ''
    onProviderSelect(form.llm_provider)
  }
  loading.value = false
}

async function save() {
  saving.value = true
  try {
    const payload: Record<string, any> = { ...form }
    if (!payload.llm_provider) {
      delete payload.llm_provider
      delete payload.backend_url
    }
    await settingsStore.update(payload)
    message.success(t('settings.saved'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
