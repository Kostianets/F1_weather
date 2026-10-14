import { compass, dayKey, fmt, fmtWeekday } from '../lib/format'
import { pct, useUnits } from '../lib/units'
import type { Day, Session } from '../types'
import { WindArrow } from './Sessions'
import WeatherIcon from './WeatherIcon'

interface Props {
  days: Day[]
  sessions: Session[]
  tz: string
  now: number
}

export default function Daily({ days, sessions, tz, now }: Props) {
  const units = useUnits()
  const today = dayKey(now, tz)
  const onDay = (key: string) => sessions.filter((s) => dayKey(s.start, tz) === key)
  // The feed starts a day back, so skip ahead to today.
  const upcoming = days.filter((d) => d.tMax != null)
  const start = upcoming.findIndex((d) => dayKey(d.t, tz) === today)

  return (
    <section>
      <h2>Days ahead</h2>
      <div className="daily">
        {upcoming.slice(Math.max(0, start)).map((d) => {
          const key = dayKey(d.t, tz)
          const tags = onDay(key)
          return (
            <div key={d.t} className={`panel day${tags.length ? ' race-day' : ''}`}>
              <div className="day-name">
                {key === today ? 'Today' : fmtWeekday(d.t, tz)}
                <span>{fmt(d.t, tz, { day: 'numeric', month: 'short' })}</span>
              </div>
              <WeatherIcon code={d.code} size={38} />
              <div className="day-temps">
                <b>{units.temp(d.tMax)}</b>
                <span>{units.temp(d.tMin)}</span>
              </div>
              <div className="day-row">
                <span className="rain-dot" /> {pct(d.popMax)} · {units.precip(d.precip)} {units.precipUnit}
              </div>
              <div className="day-row">
                <WindArrow dir={d.windDir} size={12} /> {units.speed(d.windMax)} {units.speedUnit} {compass(d.windDir)}
              </div>
              <div className="day-tags">{tags.map((s) => s.short).join(' · ')}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
