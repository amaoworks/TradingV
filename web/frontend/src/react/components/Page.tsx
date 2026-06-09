import { Banner, Button, Empty, LayerCard, Table } from '@cloudflare/kumo'
import { FolderSimpleDashed } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="kumo-page-header">
      <div>
        {eyebrow ? <p className="kumo-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="kumo-page-actions">{actions}</div> : null}
    </header>
  )
}

export function SectionCard({
  title,
  extra,
  children,
}: {
  title?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <LayerCard className="kumo-card">
      {title || extra ? (
        <div className="kumo-card-header">
          {title ? <h2>{title}</h2> : <span />}
          {extra}
        </div>
      ) : null}
      {children}
    </LayerCard>
  )
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null
  return <Banner variant="error" title={message} />
}

export function LoadingEmpty({ loading, title }: { loading: boolean; title: string }) {
  const { t } = useI18n()
  return (
    <Empty
      size="sm"
      icon={loading ? undefined : <FolderSimpleDashed size={24} />}
      title={loading ? t('common.saving') : title}
      description={loading ? undefined : ''}
      className="kumo-empty-dashed"
    />
  )
}

export function PaginationBar({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const { t } = useI18n()
  const maxPage = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="kumo-pagination-bar">
      <span>
        {page} / {maxPage} · {total}
      </span>
      <div>
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t('common.prev') === 'common.prev' ? 'Prev' : t('common.prev')}
        </Button>
        <Button size="sm" disabled={page >= maxPage} onClick={() => onPageChange(page + 1)}>
          {t('common.next') === 'common.next' ? 'Next' : t('common.next')}
        </Button>
      </div>
    </div>
  )
}

export function KumoTable({ children }: { children: ReactNode }) {
  return (
    <div className="kumo-table-wrap">
      <Table>{children}</Table>
    </div>
  )
}
