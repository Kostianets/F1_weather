import { useMemo, useState } from 'react'
import { useUnits } from '../lib/units'
import type { Hour, Session } from '../types'
import Chart from './Chart'
import type { Band } from './Chart'

const HOUR = 3_600_000

interface Props {
  hours: Hour[]
  sessions: Session[]
  tz: string
  now: number
}

type Range = 'next' | 'weekend'

const map = (hours: Hour[], pick: (h: Hour) => number | null, convert: (v: number) => number = (v) => v) =>
  hours.map((h) => {
    const v = pick(h)
    return v == null ? null : convert(v)
  })

export default function Charts({ hours, sessions, tz, now }: Props) {
  const units = useUnits()
  const [hover, setHover] = useState<number | null>(null)

  const weekendFrom = sessions[0].start - 6 * HOUR
  const weekendTo = sessions[sessions.length - 1].end + 3 * HOUR
  const lastForecast = hours.findLast((h) => h.temp != null)?.t ?? 0
  const weekendReady = lastForecast >= weekendTo
  const [choice, setChoice] = useState<Range | null>(null)
  const range: Range = choice ?? (weekendReady && weekendFrom - now < 24 * HOUR ? 'weekend' : 'next')

  const slice = useMemo(() => {
    const from = range === 'weekend' ? weekendFrom : now - HOUR
    const to = range === 'weekend' ? weekendTo : now + 48 * HOUR
    return hours.filter((h) => h.t >= from && h.t <= to && h.temp != null)
  }, [hours, range, weekendFrom, weekendTo, now])

  if (slice.length < 2) return null
  const times = slice.map((h) => h.t)
  const bands: Band[] = sessions.map((s) => ({ start: s.start, end: s.end, label: s.short }))
  const shared = { times, bands, now, tz, hover, onHover: setHover }

  return (
    <section>
      <div className="panel-head">
        <h2>Hour by hour</h2>
        <div className="tabs" role="group" aria-label="Chart period">
          <button className={range === 'next' ? 'on' : ''} aria-pressed={range === 'next'} onClick={() => setChoice('next')}>
            Next 48 h
          </button>
          <button
            className={range === 'weekend' ? 'on' : ''} aria-pressed={range === 'weekend'}
            disabled={!weekendReady}
            title={weekendReady ? undefined : 'The race weekend is still beyond the forecast range'}
            onClick={() => setChoice('weekend')}
          >
            Race weekend
          </button>
        </div>
      </div>
      <div className="charts">
        <Chart
          {...shared}
          title="Temperature"
          unit={units.tempUnit}
          series={[
            { label: 'Track est.', color: '#ff8a3d', values: map(slice, (h) => h.trackTemp, units.toTemp) },
            { label: 'Air', color: '#ffd166', values: map(slice, (h) => h.temp, units.toTemp), kind: 'area' },
            { label: 'Feels', color: '#8b90a0', values: map(slice, (h) => h.feels, units.toTemp), dashed: true },
          ]}
        />
        <Chart
          {...shared}
          title="Rain"
          unit="%"
          rightUnit={units.precipUnit}
          min={0}
          max={100}
          series={[
            { label: 'Chance', color: '#4cc9f0', values: map(slice, (h) => h.pop), kind: 'area' },
            {
              label: 'Amount',
              color: '#3a86ff',
              values: map(slice, (h) => h.precip, units.toPrecip),
              axis: 'right',
              unit: ` ${units.precipUnit}`,
              digits: units.system === 'metric' ? 1 : 2,
            },
          ]}
        />
        <Chart
          {...shared}
          title="Wind"
          unit={units.speedUnit}
          min={0}
          series={[
            { label: 'Gusts', color: '#c77dff', values: map(slice, (h) => h.gust, units.toSpeed), dashed: true },
            { label: 'Speed', color: '#80ed99', values: map(slice, (h) => h.wind, units.toSpeed), kind: 'area' },
          ]}
        />
        <Chart
          {...shared}
          title="Cloud cover and humidity"
          unit="%"
          min={0}
          max={100}
          series={[
            { label: 'Cloud', color: '#cfd4e0', values: map(slice, (h) => h.cloud), kind: 'area' },
            { label: 'Low cloud', color: '#6c7387', values: map(slice, (h) => h.cloudLow), dashed: true },
            { label: 'Humidity', color: '#4cc9f0', values: map(slice, (h) => h.rh) },
          ]}
        />
      </div>
    </section>
  )
}
