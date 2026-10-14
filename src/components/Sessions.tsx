import { FORECAST_DAYS } from '../api/weather'
import { compass, fmtDay, fmtDayTime, fmtTime } from '../lib/format'
import { pct, useUnits } from '../lib/units'
import { condition } from '../lib/wmo'
import type { Session, SessionForecast } from '../types'
import WeatherIcon from './WeatherIcon'

const DAY = 86_400_000

interface Props {
  sessions: Session[]
  forecasts: Map<string, SessionForecast | null>
  tz: string | undefined
  now: number
  loaded: boolean
}

export function WindArrow({ dir, size = 14 }: { dir: number | null; size?: number }) {
  if (dir == null) return null
  // Meteorological direction is where wind comes from; the arrow points where it goes.
  return (
    <svg aria-hidden="true" className="wind-arrow" width={size} height={size} viewBox="0 0 16 16" style={{ transform: `rotate(${dir + 180}deg)` }}>
      <path d="M8 1.5l4.5 7H9.2v6H6.8v-6H3.5z" />
    </svg>
  )
}

export default function Sessions({ sessions, forecasts, tz, now, loaded }: Props) {
  const units = useUnits()
  return (
    <section>
      <h2>Session forecast</h2>
      <div className="sessions">
        {sessions.map((s) => {
          const f = forecasts.get(s.key)
          const done = s.end <= now
          const live = s.start <= now && now < s.end
          return (
            <article key={s.key} className={`panel session${done ? ' done' : ''}${live ? ' live' : ''}`}>
              <header>
                <span className="session-short">{s.short}</span>
                <span className="session-name">{s.name}</span>
                {live && <span className="chip state-live">Live</span>}
                {done && <span className="chip">Finished</span>}
              </header>
              <div className="session-time">
                <b>{fmtDay(s.start, tz)}</b> · {fmtTime(s.start, tz)} track
                <span>{fmtDayTime(s.start)} your time</span>
              </div>
              {f ? (
                <>
                  <div className="session-main">
                    <WeatherIcon code={f.code} isDay={f.isDay} size={46} />
                    <div>
                      <div className="session-temp">{units.temp(f.temp)}</div>
                      <div className="session-cond">{condition(f.code).label}</div>
                    </div>
                    <span className={`chip state-${f.trackState}`}>{f.trackState}</span>
                  </div>
                  <dl className="session-stats">
                    <div>
                      <dt>Track est.</dt>
                      <dd>{units.temp(f.trackTemp)}</dd>
                    </div>
                    <div>
                      <dt>Rain chance</dt>
                      <dd className={(f.pop ?? 0) >= 40 ? 'warn' : ''}>{pct(f.pop)}</dd>
                    </div>
                    <div>
                      <dt>Rain</dt>
                      <dd>
                        {units.precip(f.precip)} <small>{units.precipUnit}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Wind</dt>
                      <dd>
                        <WindArrow dir={f.windDir} /> {units.speed(f.wind)} <small>{units.speedUnit}</small> {compass(f.windDir)}
                      </dd>
                    </div>
                    <div>
                      <dt>Gusts</dt>
                      <dd>
                        {units.speed(f.gust)} <small>{units.speedUnit}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Cloud</dt>
                      <dd>{pct(f.cloud)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="session-none">
                  {!loaded
                    ? 'Loading…'
                    : done
                      ? 'Session is over.'
                      : `Too far ahead to forecast. Expected from ${fmtDay(s.start - (FORECAST_DAYS - 1) * DAY)}.`}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
