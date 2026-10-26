import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { getNextRace, mergeNext } from './api/schedule'
import { getAirQuality, getWeather } from './api/weather'
import Calendar from './components/Calendar'
import Charts from './components/Charts'
import Daily from './components/Daily'
import Hero from './components/Hero'
import Metrics from './components/Metrics'
import Sessions from './components/Sessions'
import Standings from './components/Standings'
import PanelBoundary from './components/PanelBoundary'
import WindCompass from './components/WindCompass'
import { fmtTime } from './lib/format'
import { hourAt, sessionForecast } from './lib/track'
import { UnitsContext, makeUnits } from './lib/units'
import type { UnitSystem } from './lib/units'
import type { AirQuality, NextRace, SessionForecast, Weather } from './types'

// Leaflet is the heaviest dependency, so the map loads after the rest of the page.
const WeatherMap = lazy(() => import('./components/WeatherMap'))

const HOUR = 3_600_000
const REFRESH = 10 * 60_000
const UNITS_KEY = 'track-weather-units'

type View = 'forecast' | 'calendar' | 'standings'

const VIEWS: { key: View; label: string }[] = [
  { key: 'forecast', label: 'Forecast' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'standings', label: 'Standings' },
]

// The view lives in the URL hash so each one can be linked and survives a reload.
const viewFromHash = (): View => VIEWS.find((v) => v.key !== 'forecast' && location.hash === `#${v.key}`)?.key ?? 'forecast'

function storedUnits(): UnitSystem {
  try {
    return localStorage.getItem(UNITS_KEY) === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export default function App() {
  const [system, setSystem] = useState<UnitSystem>(storedUnits)
  const units = useMemo(() => makeUnits(system), [system])
  const [next, setNext] = useState<NextRace | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [air, setAir] = useState<AirQuality | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const [view, setView] = useState<View>(viewFromHash)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Back/forward and hand-edited URLs.
  useEffect(() => {
    const sync = () => setView(viewFromHash())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  // Re-read the calendar too, so rescheduled sessions show up without a reload.
  useEffect(() => {
    let cancelled = false
    const load = () => getNextRace().then((fresh) => !cancelled && setNext((prev) => mergeNext(prev, fresh)))
    load()
    const id = setInterval(load, REFRESH)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const race = next?.race
  useEffect(() => {
    if (!race) return
    let cancelled = false
    const load = () => {
      getWeather(race.lat, race.lon)
        .then((w) => {
          if (cancelled) return
          setWeather(w)
          setError(null)
        })
        .catch((e: Error) => !cancelled && setError(e.message))
      getAirQuality(race.lat, race.lon)
        .then((a) => !cancelled && setAir(a))
        .catch(() => !cancelled && setAir(null))
    }
    load()
    const id = setInterval(load, REFRESH)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [race])

  const forecasts = useMemo(() => {
    const out = new Map<string, SessionForecast | null>()
    if (race && weather) for (const s of race.sessions) out.set(s.key, sessionForecast(weather.hours, s))
    return out
  }, [race, weather])

  const chooseUnits = (value: UnitSystem) => {
    setSystem(value)
    try {
      localStorage.setItem(UNITS_KEY, value)
    } catch {
      // Storage can be blocked; the choice still applies for this visit.
    }
  }

  const chooseView = (value: View) => {
    if (value === view) return
    history.pushState(null, '', value === 'forecast' ? location.pathname + location.search : `#${value}`)
    setView(value)
  }

  const nowHour = weather ? hourAt(weather.hours, now) : undefined
  const upcoming = weather ? weather.hours.filter((h) => h.t > now - HOUR && h.t <= now + 6 * HOUR) : []
  const tz = weather?.timezone

  return (
    <UnitsContext.Provider value={units}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          Track Weather
        </div>
        <div className="topbar-right">
          {weather && view === 'forecast' && <span className="updated">Updated {fmtTime(weather.fetchedAt)}</span>}
          <div className="tabs" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => chooseView(v.key)}>
                {v.label}
              </button>
            ))}
          </div>
          <div className="tabs" role="group" aria-label="Units">
            <button className={system === 'metric' ? 'on' : ''} aria-pressed={system === 'metric'} onClick={() => chooseUnits('metric')}>
              °C · km/h
            </button>
            <button className={system === 'imperial' ? 'on' : ''} aria-pressed={system === 'imperial'} onClick={() => chooseUnits('imperial')}>
              °F · mph
            </button>
          </div>
        </div>
      </header>

      <main>
        {!next || !race ? (
          <div className="panel loading" role="status">
            Finding the next Grand Prix…
          </div>
        ) : (
          <>
            {next.source === 'bundled' && (
              <div className="banner" role="status">
                Live calendar is unreachable. Showing the bundled {race.season} schedule, which may be out of date.</div>
            )}
            {view === 'calendar' ? (
              <PanelBoundary name="calendar">
                <Calendar next={next} now={now} />
              </PanelBoundary>
            ) : view === 'standings' ? (
              <PanelBoundary name="standings">
                <Standings next={next} now={now} />
              </PanelBoundary>
            ) : (
              <>
                {error && (
                  <div className="banner error" role="alert">
                    Weather could not be loaded: {error}. Retrying automatically.
                  </div>
                )}

                <PanelBoundary name="race overview">
                  <Hero next={next} weather={weather} nowHour={nowHour} upcoming={upcoming} />
                </PanelBoundary>
                <PanelBoundary name="session forecast">
                  <Sessions sessions={race.sessions} forecasts={forecasts} tz={tz} now={now} loaded={weather != null} />
                </PanelBoundary>
                <PanelBoundary name="weather map">
                  <Suspense fallback={<div className="panel loading map-loading">Loading map…</div>}>
                    <WeatherMap lat={race.lat} lon={race.lon} circuitId={race.circuitId} tz={tz} sessions={race.sessions} />
                  </Suspense>
                </PanelBoundary>

                {weather && (
                  <>
                    <div className="split">
                      <PanelBoundary name="conditions">
                        <Metrics weather={weather} nowHour={nowHour} air={air} />
                      </PanelBoundary>
                      <PanelBoundary name="wind">
                        <WindCompass race={race} current={weather.current} forecasts={forecasts} />
                      </PanelBoundary>
                    </div>
                    <PanelBoundary name="hourly charts">
                      <Charts hours={weather.hours} sessions={race.sessions} tz={weather.timezone} now={now} />
                    </PanelBoundary>
                    <PanelBoundary name="days ahead">
                      <Daily days={weather.days} sessions={race.sessions} tz={weather.timezone} now={now} />
                    </PanelBoundary>
                  </>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer>
        <p>
          Forecasts by <a href="https://open-meteo.com">Open-Meteo</a> · radar by <a href="https://www.rainviewer.com">RainViewer</a> · satellite by{' '}
          <a href="https://www.eumetsat.int">EUMETSAT</a> · calendar and standings by <a href="https://github.com/jolpica/jolpica-f1">Jolpica F1</a> · circuit outlines by{' '}
          <a href="https://github.com/bacinger/f1-circuits">bacinger/f1-circuits</a> · map by <a href="https://www.esri.com">Esri</a>
        </p>
        <p>
          Track temperature and track state are estimates derived from forecast data, not measurements. Unofficial project, not associated with Formula 1.
        </p>
      </footer>
    </UnitsContext.Provider>
  )
}
