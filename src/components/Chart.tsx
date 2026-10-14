import { useEffect, useRef, useState } from 'react'
import { fmtDayTime, fmtWeekday, localHour } from '../lib/format'

export interface Series {
  label: string
  color: string
  values: (number | null)[]
  kind?: 'line' | 'area' | 'bar'
  /** Bars are drawn against their own scale on the right-hand axis. */
  axis?: 'left' | 'right'
  dashed?: boolean
  unit?: string
  digits?: number
}

export interface Band {
  start: number
  end: number
  label: string
}

interface Props {
  title: string
  times: number[]
  series: Series[]
  unit: string
  rightUnit?: string
  min?: number
  max?: number
  bands: Band[]
  now: number
  tz: string
  hover: number | null
  onHover: (index: number | null) => void
}

const H = 200
const M = { l: 40, t: 22, b: 24 }

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw))
  const f = raw / pow
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
}

function ticks(lo: number, hi: number, count = 4) {
  if (hi - lo < 1e-9) hi = lo + 1
  const step = niceStep((hi - lo) / count)
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const values: number[] = []
  for (let v = min; v <= max + step / 2; v += step) values.push(v)
  return { min, max, values, step }
}

function extent(series: Series[]): [number, number] {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null)
  return all.length ? [Math.min(...all), Math.max(...all)] : [0, 1]
}

const tickLabel = (v: number, step: number) => (step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)))

export default function Chart({ title, times, series, unit, rightUnit, min, max, bands, now, tz, hover, onHover }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const left = series.filter((s) => s.axis !== 'right')
  const right = series.filter((s) => s.axis === 'right')
  const mr = right.length ? 40 : 10
  const iw = width - M.l - mr
  const ih = H - M.t - M.b
  const n = times.length
  const t0 = times[0]
  const span = times[n - 1] - t0 || 1
  const x = (t: number) => M.l + ((t - t0) / span) * iw

  const [lo, hi] = extent(left)
  const yl = ticks(min ?? lo, max ?? hi)
  const y = (v: number) => M.t + ih - ((v - yl.min) / (yl.max - yl.min)) * ih
  const yr = ticks(0, Math.max(extent(right)[1], 1e-6), 2)
  const yRight = (v: number) => M.t + ih - (v / yr.max) * ih

  const path = (values: (number | null)[]) => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(times[i]).toFixed(1)} ${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const area = (values: (number | null)[]) => {
    const pts = values.map((v, i) => (v == null ? null : [x(times[i]), y(v)])).filter((p): p is number[] => p != null)
    if (pts.length < 2) return ''
    const base = M.t + ih
    return `M${pts[0][0].toFixed(1)} ${base}${pts.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')}L${pts[pts.length - 1][0].toFixed(1)} ${base}Z`
  }

  const multiDay = span > 80 * 3_600_000
  const xTicks = times
    .map((t) => ({ t, hour: localHour(t, tz) }))
    .filter(({ hour }) => hour % (multiDay ? 12 : 6) === 0)

  // On narrow charts back-to-back sessions sit too close for both labels to fit.
  const visibleBands: { label: string; x0: number; x1: number; labelled: boolean }[] = []
  for (const b of bands) {
    const x0 = Math.max(M.l, x(b.start))
    const x1 = Math.min(M.l + iw, x(b.end))
    if (x1 <= x0) continue
    const prev = visibleBands.findLast((v) => v.labelled)
    visibleBands.push({ label: b.label, x0, x1, labelled: !prev || (x0 + x1) / 2 - (prev.x0 + prev.x1) / 2 > 26 })
  }

  const nowIndex = Math.min(n - 1, Math.max(0, Math.round(((now - t0) / span) * (n - 1))))
  const shown = hover ?? nowIndex
  const barWidth = Math.max(1.5, (iw / n) * 0.7)

  return (
    <div className="chart panel" ref={wrap}>
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="chart-legend" aria-live="polite">
          <span className="chart-time">{fmtDayTime(times[shown], tz)}</span>
          {series.map((s) => {
            const v = s.values[shown]
            return (
              <span key={s.label}>
                <i style={{ background: s.color }} />
                {s.label} <b>{v == null ? '–' : v.toFixed(s.digits ?? 0)}</b>
                {s.unit ?? unit}
              </span>
            )
          })}
        </div>
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${title} chart. Use the left and right arrow keys to step through the hours.`}
        tabIndex={0}
        onFocus={() => onHover(nowIndex)}
        onBlur={() => onHover(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          e.preventDefault()
          const step = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 6 : 1)
          onHover(Math.min(n - 1, Math.max(0, (hover ?? nowIndex) + step)))
        }}
        onMouseLeave={() => onHover(null)}
        onMouseMove={(e) => {
          const px = e.clientX - e.currentTarget.getBoundingClientRect().left
          onHover(Math.min(n - 1, Math.max(0, Math.round(((px - M.l) / iw) * (n - 1)))))
        }}
      >
        {visibleBands.map((b) => (
          <g key={b.label}>
            <rect x={b.x0} y={M.t} width={b.x1 - b.x0} height={ih} className="chart-band" />
            {b.labelled && (
              <text x={(b.x0 + b.x1) / 2} y={M.t - 7} className="chart-band-label">
                {b.label}
              </text>
            )}
          </g>
        ))}
        {yl.values.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={M.l + iw} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={M.l - 6} y={y(v) + 3.5} className="chart-tick" textAnchor="end">
              {tickLabel(v, yl.step)}
            </text>
          </g>
        ))}
        {right.length > 0 &&
          yr.values.map((v) => (
            <text key={v} x={M.l + iw + 6} y={yRight(v) + 3.5} className="chart-tick">
              {tickLabel(v, yr.step)}
            </text>
          ))}
        <text x={M.l - 6} y={11} className="chart-tick" textAnchor="end">
          {unit}
        </text>
        {rightUnit && (
          <text x={M.l + iw + 6} y={11} className="chart-tick">
            {rightUnit}
          </text>
        )}
        {xTicks.map(({ t, hour }) => (
          <g key={t}>
            {hour === 0 && <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + ih} className="chart-day" />}
            <text x={x(t)} y={H - 7} className={`chart-tick${hour === 0 ? ' strong' : ''}`} textAnchor="middle">
              {hour === 0 ? fmtWeekday(t, tz) : `${String(hour).padStart(2, '0')}h`}
            </text>
          </g>
        ))}
        {right.map((s) =>
          s.values.map((v, i) =>
            v ? (
              <rect
                key={`${s.label}${i}`}
                x={x(times[i]) - barWidth / 2}
                y={yRight(v)}
                width={barWidth}
                height={M.t + ih - yRight(v)}
                fill={s.color}
                opacity={0.75}
              />
            ) : null,
          ),
        )}
        {left.map((s) => (
          <g key={s.label}>
            {s.kind === 'area' && <path d={area(s.values)} fill={s.color} opacity={0.16} />}
            <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '4 4' : undefined} />
          </g>
        ))}
        {now >= t0 && now <= times[n - 1] && <line x1={x(now)} x2={x(now)} y1={M.t} y2={M.t + ih} className="chart-now" />}
        {hover != null && (
          <>
            <line x1={x(times[hover])} x2={x(times[hover])} y1={M.t} y2={M.t + ih} className="chart-cursor" />
            {left.map((s) => {
              const v = s.values[hover]
              return v == null ? null : <circle key={s.label} cx={x(times[hover])} cy={y(v)} r={3.5} fill={s.color} className="chart-dot" />
            })}
          </>
        )}
      </svg>
    </div>
  )
}
