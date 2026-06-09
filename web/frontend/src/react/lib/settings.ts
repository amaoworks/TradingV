import api from './api'
import type {
  ModelCatalog,
  ProviderConnection,
  ProviderOption,
  Settings,
} from './types'

export async function fetchSettings() {
  const { data } = await api.get<Settings>('/api/settings')
  return data
}

export async function updateSettings(partial: Partial<Settings>) {
  await api.put('/api/settings', partial)
  return fetchSettings()
}

export async function fetchModelCatalog() {
  const { data } = await api.get<{ providers?: ModelCatalog }>('/api/model-catalog')
  return data.providers || {}
}

export async function fetchProviderConnections() {
  const { data } = await api.get<{
    providers?: ProviderConnection[]
    available?: ProviderOption[]
  }>('/api/provider-connections')
  return {
    providers: data.providers || [],
    available: data.available || [],
  }
}
