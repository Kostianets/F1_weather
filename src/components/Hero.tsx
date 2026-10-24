import { useEffect, useState } from 'react'
import { compass, countdownParts, fmtDay, fmtTime } from '../lib/format'
import { pct, useUnits } from '../lib/units'
import { condition } from '../lib/wmo'
import type { Hour, NextRace, Session, Weather } from '../types'
import WeatherIcon from './WeatherIcon'

const TRACK_STATE = { dry: 'Dry track', damp: 'Damp track', wet: 'Wet track' }

function Countdown({ sessions }: { sessions: Session[] }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const live = sessions.find((s) => s.start <= now && now < s.end)
  const next = sessions.find((s) => s.start > now)
  if (live) {
    return (
      <div className="countdown">
        <div className="label">
          <span className="live-dot" /> Session under way
        </div>
        <div className="countdown-live">{live.name}</div>
      </div>
    )
  }
  if (!next) {
    return (
      <div className="countdown">
        <div className="label">Race weekend complete</div>
      </div>
    )
  }
  const p = countdownParts(next.start - now)
  const cells: [number, string][] = [
    [p.days, 'days'],
    [p.hours, 'hrs'],
    [p.minutes, 'min'],
    [p.seconds, 'sec'],
  ]
  return (
    <div className="countdown">
      <div className="label">{next.name} starts in</div>
      <div className="countdown-cells">
        {cells.map(([value, unit]) => (
          <div key={unit} className="countdown-cell">
            <span className="countdown-value">{String(value).padStart(2, '0')}</span>
            <span className="countdown-unit">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface Props {
  next: NextRace
  weather: Weather | null
  nowHour: Hour | undefined
  upcoming: Hour[]
}

export default function Hero({ next, weather, nowHour, upcoming }: Props) {
  const units = useUnits()
  const { race } = next
  const first = race.sessions[0]
  const last = race.sessions[race.sessions.length - 1]
  const tz = weather?.timezone
  const c = weather?.current

  const rainChance = Math.max(0, ...upcoming.map((h) => h.pop ?? 0))
  const rainTotal = upcoming.reduce((a, h) => a + (h.precip ?? 0), 0)

  return (
    <section className="hero panel">
      <div className="hero-race">
        <div className="label">
          Round {race.round} of {next.races.length} · {race.season}
          {next.finished && ' · season finished'}
        </div>
        <h1>{race.name}</h1>
        <div className="hero-circuit">{race.circuitName}</div>
        <div className="hero-place">
          {race.locality}, {race.country} · {fmtDay(first.start, tz)} – {fmtDay(last.start, tz)}
        </div>
        <Countdown sessions={race.sessions} />
      </div>

      <div className="hero-now">
        {c ? (
          <>
            <div className="label">
              At the track now · {fmtTime(c.t, tz)} {weather.tzAbbr}
            </div>
            <div className="hero-now-main">
              <WeatherIcon code={c.code} isDay={c.isDay} size={84} />
              <div>
                <div className="hero-temp">
                  {units.temp(c.temp)}
                  <span>{units.tempUnit.slice(1)}</span>
                </div>
                <div className="hero-cond">{condition(c.code).label}</div>
              </div>
            </div>
            <div className="hero-stats">
              <div>
                <span className="label">Feels like</span>
                <b>{units.temp(c.feels)}</b>
              </div>
              <div>
                <span className="label">Track est.</span>
                <b>{units.temp(nowHour?.trackTemp)}</b>
              </div>
              <div>
                <span className="label">Wind</span>
                <b>
                  {units.speed(c.wind)} <small>{units.speedUnit}</small> {compass(c.windDir)}
                </b>
              </div>
              <div>
                <span className="label">Humidity</span>
                <b>{pct(c.rh)}</b>
              </div>
            </div>
            <div className="hero-chips">
              {nowHour && <span className={`chip state-${nowHour.trackState}`}>{TRACK_STATE[nowHour.trackState]}</span>}
              <span className="chip">
                Next 6 h: {pct(rainChance)} rain chance
                {rainTotal >= 0.1 && ` · ${units.precip(rainTotal)} ${units.precipUnit}`}
              </span>
            </div>
          </>
        ) : (
          <div className="loading">Loading track weather…</div>
        )}
      </div>
    </section>
  )
}
