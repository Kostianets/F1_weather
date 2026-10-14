import { useMemo, useState } from 'react'
import { compass } from '../lib/format'
import { circuitOutline, longestStraight, windOnStraight } from '../lib/track'
import { useUnits } from '../lib/units'
import type { Current, Race, SessionForecast } from '../types'

interface Props {
  race: Race
  current: Current
  forecasts: Map<string, SessionForecast | null>
}

const SIZE = 300
const C = SIZE / 2
const R = 128

export default function WindCompass({ race, current, forecasts }: Props) {
  const units = useUnits()
  const [pick, setPick] = useState('now')

  const options = [
    { key: 'now', label: 'Now' },
    ...race.sessions.filter((s) => forecasts.get(s.key)).map((s) => ({ key: s.key as string, label: s.short })),
  ]
  const chosen = pick !== 'now' ? forecasts.get(pick) : null
  const wind = chosen ?? current
  const active = chosen ? pick : 'now'

  const shape = useMemo(() => {
    const outline = circuitOutline(race.circuitId)
    if (!outline) return null
    const k = Math.cos((race.lat * Math.PI) / 180)
    const xs = outline.map((p) => p[0] * k)
    const ys = outline.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const scale = (R * 1.25) / Math.max(maxX - minX, maxY - minY)
    const pts = outline.map((_, i) => [
      C + (xs[i] - (minX + maxX) / 2) * scale,
      C - (ys[i] - (minY + maxY) / 2) * scale,
    ])
    const line = (from: number, to: number) => pts.slice(from, to + 1).map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')
    const straight = longestStraight(outline)
    return { path: line(0, pts.length - 1), straight, straightPath: straight && line(straight.from, straight.to) }
  }, [race.circuitId, race.lat])

  const dir = wind.windDir
  const split = dir != null && wind.wind != null && shape?.straight ? windOnStraight(wind.wind, dir, shape.straight.bearing) : null

  return (
    <div className="panel compass">
      <div className="panel-head">
        <h2>Wind over the circuit</h2>
        <div className="tabs" role="group" aria-label="Wind for">
          {options.map((o) => (
            <button key={o.key} className={o.key === active ? 'on' : ''} aria-pressed={o.key === active} onClick={() => setPick(o.key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="compass-svg"
        role="img"
        aria-label={dir == null ? 'Circuit outline' : `Circuit outline with wind blowing from ${compass(dir)}`}
      >
        <circle cx={C} cy={C} r={R} className="compass-ring" />
        {['N', 'E', 'S', 'W'].map((p, i) => (
          <text
            key={p}
            x={C + Math.sin((i * Math.PI) / 2) * (R + 12)}
            y={C - Math.cos((i * Math.PI) / 2) * (R + 12)}
            className="compass-point"
          >
            {p}
          </text>
        ))}
        {shape && <polyline points={shape.path} className="compass-track" />}
        {shape?.straightPath && <polyline points={shape.straightPath} className="compass-straight" />}
        {dir != null && (
          <g transform={`rotate(${dir} ${C} ${C})`} className="compass-wind">
            {[-56, 0, 56].map((dx) => (
              <g key={dx} transform={`translate(${dx} ${dx === 0 ? 0 : 22})`}>
                <line x1={C} y1={C - R + 10} x2={C} y2={C + R - 34} />
                <path d={`M${C} ${C + R - 18}l-7 -16h14z`} />
              </g>
            ))}
          </g>
        )}
      </svg>
      <div className="compass-read">
        <div>
          <span className="label">From</span>
          <b>
            {compass(dir)} {dir == null ? '' : `${Math.round(dir)}°`}
          </b>
        </div>
        <div>
          <span className="label">Speed</span>
          <b>
            {units.speed(wind.wind)} <small>{units.speedUnit}</small>
          </b>
        </div>
        <div>
          <span className="label">Gusts</span>
          <b>
            {units.speed(wind.gust)} <small>{units.speedUnit}</small>
          </b>
        </div>
      </div>
      {split && shape?.straight && (
        <p className="note">
          <span className="swatch straight" /> Longest straight ({Math.round(shape.straight.length)} m): about{' '}
          <b>
            {units.speed(split.along)} {units.speedUnit}
          </b>{' '}
          along it and{' '}
          <b>
            {units.speed(split.across)} {units.speedUnit}
          </b>{' '}
          across it.
        </p>
      )}
      {!shape && <p className="note">No outline available for this circuit.</p>}
    </div>
  )
}
