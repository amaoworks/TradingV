export interface AnalysisItem {
  id: string
  ticker: string
  trade_date: string
  asset_type: string
  status: string
  signal?: string
  confidence?: number
  created_at: string
  completed_at?: string
}

export interface Settings {
  llm_provider: string
  deep_think_llm: string
  quick_think_llm: string
  backend_url: string | null
  max_debate_rounds: number
  max_risk_discuss_rounds: number
  output_language: string
  checkpoint_enabled: boolean
  benchmark_ticker: string | null
  data_cache_dir: string
  results_dir: string
  memory_log_path: string
}

export interface ModelOption {
  label: string
  value: string
}

export type ModelCatalog = Record<string, { quick: ModelOption[]; deep: ModelOption[] }>

export interface ProviderConnection {
  provider: string
  label: string
  env_var: string | null
  base_url: string
  default_base_url: string
  masked: string
  set: boolean
  required: boolean
}

export interface ProviderOption {
  provider: string
  label: string
  env_var: string | null
  required: boolean
  default_base_url: string
}

export interface PagedResponse<T> {
  items: T[]
  total: number
}
