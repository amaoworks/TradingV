import { Banner, Button, Radio, Switch } from '@cloudflare/kumo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dispose, init, LineType, TooltipShowRule, type Chart } from 'klinecharts'
import api from '../lib/api'
import { errorMessage } from '../lib/format'
import { useI18n } from '../i18n/I18nProvider'

type KLineInterval = '1min' | '5min' | '15min' | '30min' | '60min' | 'daily'

interface KLineBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export function KLineChart({
  ticker,
  entryPrice,
  targetPrice,
  stopLoss,
  redUp = true,
}: {
  ticker: string
  entryPrice?: number | null
  targetPrice?: number | null
  stopLoss?: number | null
  redUp?: boolean
}) {
  const { t, locale } = useI18n()
  const chartEl = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<Chart | null>(null)
  const [interval, setIntervalValue] = useState<KLineInterval>('daily')
  const [lookback, setLookback] = useState('60')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [latestBarLabel, setLatestBarLabel] = useState('')

  const isAShare = useMemo(() => {
    const value = ticker.toUpperCase().trim()
    return /^\d{6}$/.test(value)
      || /^\d{6}\.(SH|SS|SZ)$/.test(value)
      || /^(SH|SZ)\.?\d{6}$/.test(value)
  }, [ticker])

  const addPriceLines = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return
    for (const id of ['line-entry', 'line-target', 'line-stop']) {
      try {
        chart.removeOverlay(id)
      } catch {
        // Overlay may not exist yet.
      }
    }
    const overlays: Array<[string, number, string]> = []
    if (entryPrice && entryPrice > 0) overlays.push(['line-entry', entryPrice, '#6b7280'])
    if (targetPrice && targetPrice > 0) overlays.push(['line-target', targetPrice, '#16a34a'])
    if (stopLoss && stopLoss > 0) overlays.push(['line-stop', stopLoss, '#dc2626'])
    for (const [id, price, color] of overlays) {
      try {
        chart.createOverlay({
          id,
          name: 'horizontalStraightLine',
          points: [{ value: price }],
          styles: { line: { color, style: LineType.Dashed, size: 1 } },
        })
      } catch {
        // Price lines are an enhancement; OHLC data should still render.
      }
    }
  }, [entryPrice, stopLoss, targetPrice])

  const reload = useCallback(async () => {
    const chart = chartRef.current
    if (!ticker || !chart) return
    setLoading(true)
    setError('')
    try {
      const days = interval === 'daily' ? Number(lookback) : 240
      const { data } = await api.get<{
        bars?: KLineBar[]
      }>(`/api/quote/${encodeURIComponent(ticker)}/ohlc`, {
        params: { interval, days },
      })
      const bars = data.bars || []
      if (!bars.length) {
        chart.applyNewData([])
        setLatestBarLabel('')
        setError(t('kline.noData'))
        return
      }
      chart.applyNewData(bars)
      const last = bars[bars.length - 1]
      const formatOptions = interval === 'daily'
        ? { year: 'numeric', month: '2-digit', day: '2-digit' } as const
        : { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
      setLatestBarLabel(new Date(last.timestamp).toLocaleString(locale, formatOptions))
      addPriceLines()
    } catch (err) {
      const message = errorMessage(err, t('kline.loadFailed'))
      setError(message)
      if (interval !== 'daily' && !isAShare) setIntervalValue('daily')
    } finally {
      setLoading(false)
    }
  }, [addPriceLines, interval, isAShare, locale, lookback, t, ticker])

  useEffect(() => {
    if (!chartEl.current) return undefined
    const chart = init(chartEl.current)
    chartRef.current = chart
    if (chart) {
      const upColor = redUp ? '#dc2626' : '#16a34a'
      const downColor = redUp ? '#16a34a' : '#dc2626'
      chart.setStyles({
        candle: {
          bar: {
            upColor,
            downColor,
            upBorderColor: upColor,
            downBorderColor: downColor,
            upWickColor: upColor,
            downWickColor: downColor,
          },
          tooltip: { showRule: TooltipShowRule.Always },
        },
      })
      chart.createIndicator('MA', false, { id: 'candle_pane' })
      chart.createIndicator('VOL', false)
    }
    return () => {
      if (chartEl.current) dispose(chartEl.current)
      chartRef.current = null
    }
  }, [redUp])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!autoRefresh) return undefined
    const timer = window.setInterval(reload, interval === 'daily' ? 60_000 : 30_000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, interval, reload])

  useEffect(() => {
    setTimeout(() => chartRef.current?.resize(), 60)
  }, [fullscreen])

  return (
    <div className={fullscreen ? 'kumo-kline is-fullscreen' : 'kumo-kline'}>
      <div className="kumo-kline-toolbar">
        <Radio.Group
          legend="Interval"
          className="kumo-compact-radio"
          orientation="horizontal"
          value={interval}
          onValueChange={(value) => setIntervalValue(value as KLineInterval)}
        >
          <Radio.Item value="1min" label="1m" disabled={!isAShare} />
          <Radio.Item value="5min" label="5m" disabled={!isAShare} />
          <Radio.Item value="15min" label="15m" disabled={!isAShare} />
          <Radio.Item value="30min" label="30m" disabled={!isAShare} />
          <Radio.Item value="60min" label="60m" disabled={!isAShare} />
          <Radio.Item value="daily" label={t('kline.daily')} />
        </Radio.Group>
        {interval === 'daily' ? (
          <Radio.Group
            legend="Lookback"
            className="kumo-compact-radio"
            orientation="horizontal"
            value={lookback}
            onValueChange={setLookback}
          >
            <Radio.Item value="30" label={t('kline.days30')} />
            <Radio.Item value="60" label={t('kline.days60')} />
            <Radio.Item value="120" label={t('kline.days120')} />
            <Radio.Item value="250" label={t('kline.year1')} />
          </Radio.Group>
        ) : null}
        <Switch
          size="sm"
          label={autoRefresh ? t('kline.autoRefresh') : t('kline.manualRefresh')}
          checked={autoRefresh}
          onCheckedChange={setAutoRefresh}
        />
        <Button size="sm" loading={loading} onClick={reload}>{t('kline.refresh')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setFullscreen((value) => !value)}>
          {fullscreen ? t('kline.exitFullscreen') : t('kline.fullscreen')}
        </Button>
      </div>
      <p className="kumo-kline-hint">
        {interval === 'daily' ? t('kline.dailyHint') : t('kline.minuteHint')}
        {latestBarLabel ? ` · ${t('kline.latestBar', { label: latestBarLabel })}` : ''}
      </p>
      <div ref={chartEl} className="kumo-kline-chart" />
      {error ? <Banner variant="error" title={error} /> : null}
    </div>
  )
}
