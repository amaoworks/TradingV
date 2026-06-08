import {
  Badge,
  Banner,
  Button,
  Dialog,
  Input,
  Radio,
  Table,
  Tabs,
} from '@cloudflare/kumo'
import { ArrowCounterClockwise, ArrowsClockwise, ChartLine, Plus } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { KLineChart } from '../components/KLineChart'
import { ErrorBanner, KumoTable, LoadingEmpty, PageHeader, SectionCard } from '../components/Page'
import { useI18n } from '../i18n/I18nProvider'
import api from '../lib/api'
import { errorMessage } from '../lib/format'

interface PaperAccount {
  id: number
  name: string
  initial_cash: number
  cash: number
}

interface PaperPosition {
  id: number
  ticker: string
  name: string | null
  asset_type: string
  shares: number
  avg_cost: number
  last_price: number | null
  market_value: number | null
  pnl_amount: number | null
  pnl_pct: number | null
}

interface PaperOrder {
  id: number
  ticker: string
  name: string | null
  action: 'buy' | 'sell' | string
  shares: number
  price: number
  source: string
  source_analysis_id: string | null
  notes: string | null
  filled_at: string
}

interface NavRow {
  snapshot_date: string
  cash: number
  positions_value: number
  total_value: number
}

interface OrderForm {
  ticker: string
  action: 'buy' | 'sell'
  shares: number
  price: string
  notes: string
}

export function PaperPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState('positions')
  const [account, setAccount] = useState<PaperAccount | null>(null)
  const [positions, setPositions] = useState<PaperPosition[]>([])
  const [orders, setOrders] = useState<PaperOrder[]>([])
  const [navRows, setNavRows] = useState<NavRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [snapshotting, setSnapshotting] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderForm>({
    ticker: '',
    action: 'buy',
    shares: 0,
    price: '',
    notes: '',
  })
  const [sellTarget, setSellTarget] = useState<PaperPosition | null>(null)
  const [sellForm, setSellForm] = useState({ shares: 0, price: '' })
  const [kline, setKline] = useState<{ ticker: string; entryPrice: number | null } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [accountRes, positionsRes, ordersRes, navRes] = await Promise.all([
        api.get<PaperAccount>('/api/paper/account'),
        api.get<{ items?: PaperPosition[] }>('/api/paper/positions'),
        api.get<{ items?: PaperOrder[] }>('/api/paper/orders'),
        api.get<{ items?: NavRow[] }>('/api/paper/nav'),
      ])
      setAccount(accountRes.data)
      setPositions(positionsRes.data.items || [])
      setOrders(ordersRes.data.items || [])
      setNavRows(navRes.data.items || [])
    } catch (err) {
      setError(errorMessage(err, t('common.unknownError')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const positionsMarketValue = useMemo(
    () => positions.reduce((sum, position) => (
      sum + (position.market_value ?? position.shares * position.avg_cost)
    ), 0),
    [positions],
  )
  const totalValue = (account?.cash || 0) + positionsMarketValue
  const totalPnl = account ? totalValue - account.initial_cash : 0
  const totalPnlPct = account?.initial_cash ? (totalPnl / account.initial_cash) * 100 : 0

  function openOrder() {
    setOrderForm({ ticker: '', action: 'buy', shares: 0, price: '', notes: '' })
    setOrderOpen(true)
  }

  function openSell(position: PaperPosition) {
    setSellTarget(position)
    setSellForm({
      shares: position.shares,
      price: position.last_price != null ? String(position.last_price) : '',
    })
  }

  async function placeOrder() {
    if (!orderForm.ticker || orderForm.shares <= 0) {
      setError(t('paper.orderValidation'))
      return
    }
    setPlacing(true)
    setError('')
    try {
      await api.post('/api/paper/orders', {
        ticker: orderForm.ticker.trim().toUpperCase(),
        action: orderForm.action,
        shares: orderForm.shares,
        price: orderForm.price ? Number(orderForm.price) : undefined,
        notes: orderForm.notes || undefined,
      })
      setNotice(t('paper.msg.placed'))
      setOrderOpen(false)
      await loadAll()
    } catch (err) {
      setError(`${t('paper.msg.placeFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setPlacing(false)
    }
  }

  async function submitSell() {
    if (!sellTarget) return
    if (!sellForm.shares || sellForm.shares <= 0) {
      setError(t('paper.sellValidation.shares'))
      return
    }
    if (sellForm.shares > sellTarget.shares + 1e-9) {
      setError(t('paper.sellValidation.notEnough', { max: sellTarget.shares }))
      return
    }
    setPlacing(true)
    setError('')
    try {
      await api.post('/api/paper/orders', {
        ticker: sellTarget.ticker,
        action: 'sell',
        shares: sellForm.shares,
        price: sellForm.price ? Number(sellForm.price) : undefined,
        notes: t('paper.sellNote'),
      })
      setNotice(t('paper.msg.sold'))
      setSellTarget(null)
      await loadAll()
    } catch (err) {
      setError(`${t('paper.msg.sellFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setPlacing(false)
    }
  }

  async function flatten(position: PaperPosition) {
    if (!window.confirm(t('paper.flattenContent', { shares: position.shares, ticker: position.ticker }))) return
    setError('')
    try {
      await api.post('/api/paper/orders', {
        ticker: position.ticker,
        action: 'sell',
        shares: position.shares,
        notes: t('paper.flattenNotes'),
      })
      setNotice(t('paper.msg.flattened', { ticker: position.ticker }))
      await loadAll()
    } catch (err) {
      setError(`${t('paper.msg.flattenFailed')}${errorMessage(err, t('common.unknownError'))}`)
    }
  }

  async function takeSnapshot() {
    setSnapshotting(true)
    setError('')
    try {
      await api.post('/api/paper/nav/snapshot')
      setNotice(t('paper.msg.snapshotted'))
      setTab('nav')
      await loadAll()
    } catch (err) {
      setError(`${t('paper.msg.snapshotFailed')}${errorMessage(err, t('common.unknownError'))}`)
    } finally {
      setSnapshotting(false)
    }
  }

  async function resetAccount() {
    if (!window.confirm(t('paper.resetContent'))) return
    setError('')
    try {
      await api.post('/api/paper/account/reset', { confirm: true })
      setNotice(t('paper.msg.reset'))
      await loadAll()
    } catch (err) {
      setError(`${t('paper.msg.resetFailed')}${errorMessage(err, t('common.unknownError'))}`)
    }
  }

  return (
    <div className="kumo-page-stack">
      <PageHeader
        title={t('paper.title')}
        subtitle={t('paper.subtitle')}
        actions={
          <>
            <Button loading={snapshotting} onClick={takeSnapshot}>
              <ArrowsClockwise size={16} />
              {t('paper.snapshotBtn')}
            </Button>
            <Button onClick={openOrder}>
              <Plus size={16} />
              {t('paper.manualOrder')}
            </Button>
            <Button variant="secondary-destructive" onClick={resetAccount}>
              <ArrowCounterClockwise size={16} />
              {t('paper.resetAccount')}
            </Button>
          </>
        }
      />
      <Banner variant="alert" title={t('paper.warning')} />
      <ErrorBanner message={error} />
      {notice ? <Banner variant="default" title={notice} /> : null}

      {account ? (
        <div className="kumo-stat-grid paper">
          <Stat label={t('paper.stats.cash')} value={account.cash.toFixed(2)} />
          <Stat label={t('paper.stats.positionsValue')} value={positionsMarketValue.toFixed(2)} />
          <Stat label={t('paper.stats.totalValue')} value={totalValue.toFixed(2)} positive={totalPnl >= 0} />
          <Stat
            label={t('paper.stats.vsInitial', { n: account.initial_cash })}
            value={`${signed(totalPnl)} (${totalPnlPct.toFixed(2)}%)`}
            positive={totalPnl >= 0}
          />
        </div>
      ) : null}

      <SectionCard>
        <div className="kumo-tabs-wrap">
          <Tabs
            value={tab}
            onValueChange={setTab}
            tabs={[
              { value: 'positions', label: t('paper.tabs.positions') },
              { value: 'orders', label: t('paper.tabs.orders') },
              { value: 'nav', label: t('paper.tabs.nav') },
            ]}
          />
        </div>
        {tab === 'positions' ? (
          positions.length ? (
            <PositionsTable
              positions={positions}
              t={t}
              onSell={openSell}
              onFlatten={flatten}
              onKline={(position) => setKline({ ticker: position.ticker, entryPrice: position.avg_cost })}
            />
          ) : (
            <LoadingEmpty loading={loading} title={t('paper.noPositions')} />
          )
        ) : null}
        {tab === 'orders' ? (
          orders.length ? <OrdersTable orders={orders} t={t} /> : <LoadingEmpty loading={loading} title={t('paper.noOrders')} />
        ) : null}
        {tab === 'nav' ? (
          navRows.length ? (
            <div className="kumo-chart-panel">
              <NavChart rows={navRows} initialCash={account?.initial_cash || 0} />
            </div>
          ) : (
            <LoadingEmpty loading={loading} title={t('paper.noNav')} />
          )
        ) : null}
      </SectionCard>

      <Dialog.Root open={Boolean(kline)} onOpenChange={(open) => {
        if (!open) setKline(null)
      }}>
        <Dialog size="xl" className="kumo-kline-dialog">
          <Dialog.Title>{kline ? t('paper.klineTitle', { ticker: kline.ticker }) : ''}</Dialog.Title>
          {kline ? <KLineChart ticker={kline.ticker} entryPrice={kline.entryPrice} /> : null}
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={Boolean(sellTarget)} onOpenChange={(open) => {
        if (!open) setSellTarget(null)
      }}>
        <Dialog>
          <Dialog.Title>{t('paper.sellTitle', { ticker: sellTarget?.ticker || '' })}</Dialog.Title>
          <div className="kumo-dialog-body">
            {sellTarget && isAShareTicker(sellTarget.ticker) ? (
              <Banner variant="alert" title={t('paper.sellAShareWarning')} />
            ) : null}
            <p className="kumo-muted-text">
              {sellTarget
                ? t('paper.sellFields.currentDesc', {
                    shares: sellTarget.shares.toFixed(0),
                    cost: sellTarget.avg_cost.toFixed(2),
                  })
                : ''}
            </p>
            <Input
              type="number"
              min={0}
              max={sellTarget?.shares}
              step={1}
              label={t('paper.sellFields.sellShares')}
              value={sellForm.shares}
              onChange={(event) => setSellForm((current) => ({ ...current, shares: Number(event.currentTarget.value) }))}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('paper.sellFields.price')}
              value={sellForm.price}
              placeholder={t('paper.sellFields.pricePlaceholder')}
              onChange={(event) => setSellForm((current) => ({ ...current, price: event.currentTarget.value }))}
              description={t('paper.sellFields.estimated', {
                amount: ((sellForm.shares || 0) * (Number(sellForm.price) || sellTarget?.last_price || 0)).toFixed(2),
              })}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button {...props}>{t('common.cancel')}</Button>} />
            <Button variant="destructive" loading={placing} onClick={submitSell}>
              {t('paper.sellFields.confirm')}
            </Button>
          </div>
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={orderOpen} onOpenChange={setOrderOpen}>
        <Dialog>
          <Dialog.Title>{t('paper.manualOrderTitle')}</Dialog.Title>
          <div className="kumo-dialog-body">
            <Input
              label={t('paper.orderFields.ticker')}
              value={orderForm.ticker}
              placeholder={t('paper.orderFields.tickerPlaceholder')}
              onChange={(event) => setOrderForm((current) => ({ ...current, ticker: event.currentTarget.value.toUpperCase() }))}
            />
            <Radio.Group
              legend={t('paper.orderFields.action')}
              orientation="horizontal"
              value={orderForm.action}
              onValueChange={(value) => setOrderForm((current) => ({ ...current, action: value as OrderForm['action'] }))}
            >
              <Radio.Item value="buy" label={t('paper.orderFields.buy')} />
              <Radio.Item value="sell" label={t('paper.orderFields.sell')} />
            </Radio.Group>
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('paper.orderFields.shares')}
              value={orderForm.shares}
              onChange={(event) => setOrderForm((current) => ({ ...current, shares: Number(event.currentTarget.value) }))}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              label={t('paper.orderFields.price')}
              value={orderForm.price}
              placeholder={t('paper.orderFields.pricePlaceholder')}
              onChange={(event) => setOrderForm((current) => ({ ...current, price: event.currentTarget.value }))}
            />
            <Input
              label={t('paper.orderFields.notes')}
              value={orderForm.notes}
              onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.currentTarget.value }))}
            />
          </div>
          <div className="kumo-dialog-actions">
            <Dialog.Close render={(props) => <Button {...props}>{t('common.cancel')}</Button>} />
            <Button loading={placing} onClick={placeOrder}>{t('common.submit')}</Button>
          </div>
        </Dialog>
      </Dialog.Root>
    </div>
  )
}

function PositionsTable({
  positions,
  t,
  onSell,
  onFlatten,
  onKline,
}: {
  positions: PaperPosition[]
  t: (path: string, params?: Record<string, string | number>) => string
  onSell: (position: PaperPosition) => void
  onFlatten: (position: PaperPosition) => void
  onKline: (position: PaperPosition) => void
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Head>{t('paper.posCols.ticker')}</Table.Head>
          <Table.Head>{t('paper.posCols.name')}</Table.Head>
          <Table.Head>{t('paper.posCols.sharesCost')}</Table.Head>
          <Table.Head>{t('paper.posCols.last')}</Table.Head>
          <Table.Head>{t('paper.posCols.marketValue')}</Table.Head>
          <Table.Head>{t('paper.posCols.pnl')}</Table.Head>
          <Table.Head>{t('paper.posCols.actions')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {positions.map((position) => (
          <Table.Row key={position.id}>
            <Table.Cell>{position.ticker}</Table.Cell>
            <Table.Cell>{position.name || '-'}</Table.Cell>
            <Table.Cell>{position.shares} x {position.avg_cost.toFixed(2)}</Table.Cell>
            <Table.Cell>{position.last_price != null ? position.last_price.toFixed(2) : '-'}</Table.Cell>
            <Table.Cell>{position.market_value != null ? position.market_value.toFixed(2) : '-'}</Table.Cell>
            <Table.Cell>
              {position.pnl_amount != null ? (
                <span className={position.pnl_amount >= 0 ? 'market-up' : 'market-down'}>
                  {signed(position.pnl_amount)} ({position.pnl_pct?.toFixed(2)}%)
                </span>
              ) : '-'}
            </Table.Cell>
            <Table.Cell>
              <div className="kumo-row-actions">
                <Button size="sm" variant="secondary-destructive" onClick={() => onSell(position)}>
                  {t('paper.posBtn.sell')}
                </Button>
                <Button size="sm" onClick={() => onFlatten(position)}>{t('paper.posBtn.flatten')}</Button>
                <Button size="sm" onClick={() => onKline(position)}>
                  <ChartLine size={14} />
                  {t('paper.posBtn.kline')}
                </Button>
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function OrdersTable({
  orders,
  t,
}: {
  orders: PaperOrder[]
  t: (path: string, params?: Record<string, string | number>) => string
}) {
  return (
    <KumoTable>
      <Table.Header>
        <Table.Row>
          <Table.Head>{t('paper.orderCols.time')}</Table.Head>
          <Table.Head>{t('paper.orderCols.ticker')}</Table.Head>
          <Table.Head>{t('paper.orderCols.name')}</Table.Head>
          <Table.Head>{t('paper.orderCols.action')}</Table.Head>
          <Table.Head>{t('paper.orderCols.shares')}</Table.Head>
          <Table.Head>{t('paper.orderCols.price')}</Table.Head>
          <Table.Head>{t('paper.orderCols.amount')}</Table.Head>
          <Table.Head>{t('paper.orderCols.source')}</Table.Head>
          <Table.Head>{t('paper.orderCols.notes')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {orders.map((order) => (
          <Table.Row key={order.id}>
            <Table.Cell>{order.filled_at.replace('T', ' ').slice(0, 19)}</Table.Cell>
            <Table.Cell>{order.ticker}</Table.Cell>
            <Table.Cell>{order.name || '-'}</Table.Cell>
            <Table.Cell>
              <Badge variant={order.action === 'buy' ? 'success' : 'error'}>
                {order.action === 'buy' ? t('paper.orderFields.buy') : t('paper.orderFields.sell')}
              </Badge>
            </Table.Cell>
            <Table.Cell>{order.shares}</Table.Cell>
            <Table.Cell>{order.price.toFixed(2)}</Table.Cell>
            <Table.Cell>{(order.shares * order.price).toFixed(2)}</Table.Cell>
            <Table.Cell>
              {order.source === 'decision' && order.source_analysis_id ? (
                <Link to={`/report/${order.source_analysis_id}`} className="kumo-link-reset">
                  <Badge variant="info">{t('paper.source.decision')}</Badge>
                </Link>
              ) : order.source === 'manual' ? t('paper.source.manual') : order.source}
            </Table.Cell>
            <Table.Cell>{order.notes || '-'}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </KumoTable>
  )
}

function NavChart({ rows, initialCash }: { rows: NavRow[]; initialCash: number }) {
  const width = 720
  const height = 260
  const padding = 26
  const values = rows.map((row) => row.total_value)
  const allValues = [...values, initialCash]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const span = max - min || 1
  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / span) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  const initialY = height - padding - ((initialCash - min) / span) * (height - padding * 2)

  return (
    <svg className="kumo-nav-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={padding} x2={width - padding} y1={initialY} y2={initialY} className="baseline" />
      <polyline points={points} className="nav-line" />
      {rows.map((row, index) => {
        const [x, y] = points.split(' ')[index].split(',').map(Number)
        return <circle key={row.snapshot_date} cx={x} cy={y} r="3" />
      })}
      <text x={padding} y={18}>{max.toFixed(0)}</text>
      <text x={padding} y={height - 6}>{min.toFixed(0)}</text>
    </svg>
  )
}

function Stat({
  label,
  value,
  positive,
}: {
  label: string
  value: string | number
  positive?: boolean
}) {
  return (
    <SectionCard>
      <div className="kumo-stat">
        <span>{label}</span>
        <strong className={positive == null ? undefined : positive ? 'market-up' : 'market-down'}>
          {value}
        </strong>
      </div>
    </SectionCard>
  )
}

function signed(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function isAShareTicker(ticker: string) {
  const upper = ticker.toUpperCase().trim()
  const digits = upper.replace(/\D/g, '')
  if (digits.length !== 6) return false
  if (upper === digits) return true
  return ['SH', 'SS', 'SZ'].some((market) => upper.includes(`.${market}`) || upper.includes(`${market}.`))
}
