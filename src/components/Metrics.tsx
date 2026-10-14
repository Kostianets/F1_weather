import type { ReactNode } from 'react'
import { compass, dayKey, fmtTime } from '../lib/format'
import { pct, useUnits } from '../lib/units'
import { aqiLabel, uvLabel } from '../lib/wmo'
import type { AirQuality, Hour, Weather } from '../types'

interface Props {
  weather: Weather
  nowHour: Hour | undefined
  air: AirQuality | null
}

function Metric({ label, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: ReactNode }) {
  return (
    <div className="metric panel">
      <div className="label">{label}</div>
      <div className="metric-value">
        {value}
        {unit && <small> {unit}</small>}
      </div>
      {note && <div className="metric-note">{note}</div>}
    </div>
  )
}

export default function Metrics({ weather, nowHour, air }: Props) {
  const units = useUnits()
  const c = weather.current
  const tz = weather.timezone
  const today = weather.days.find((d) => dayKey(d.t, tz) === dayKey(c.t, tz))

  return (
    <section>
      <h2>Conditions in detail</h2>
      <div className="metrics">
        <Metric
          label="Wind"
          value={units.speed(c.wind)}
          unit={units.speedUnit}
          note={`From ${compass(c.windDir)} (${c.windDir ?? '–'}°)`}
        />
        <Metric label="Gusts" value={units.speed(c.gust)} unit={units.speedUnit} note={`Max today ${units.speed(today?.gustMax)}`} />
        <Metric label="Humidity" value={pct(c.rh)} note={`Dew point ${units.temp(nowHour?.dew)}`} />
        <Metric label="Pressure" value={units.pressure(c.pressure)} unit={units.pressureUnit} note="Sea level" />
        <Metric
          label="Cloud cover"
          value={pct(c.cloud)}
          note={`Low ${pct(nowHour?.cloudLow)} · mid ${pct(nowHour?.cloudMid)} · high ${pct(nowHour?.cloudHigh)}`}
        />
        <Metric label="Visibility" value={units.distance(nowHour?.vis)} />
        <Metric
          label="UV index"
          value={nowHour?.uv == null ? '–' : nowHour.uv.toFixed(1)}
          note={`${uvLabel(nowHour?.uv ?? null)} · max today ${today?.uvMax?.toFixed(1) ?? '–'}`}
        />
        <Metric
          label="Rain now"
          value={units.precip(c.precip)}
          unit={units.precipUnit}
          note={`Today ${units.precip(today?.precip)} ${units.precipUnit}`}
        />
        <Metric
          label="Sun"
          value={today?.sunrise ? fmtTime(today.sunrise, tz) : '–'}
          note={`Sunset ${today?.sunset ? fmtTime(today.sunset, tz) : '–'} track time`}
        />
        <Metric
          label="Air quality"
          value={air?.usAqi ?? '–'}
          unit="US AQI"
          note={air ? `${aqiLabel(air.usAqi)} · PM2.5 ${air.pm25?.toFixed(0) ?? '–'} µg/m³` : 'Unavailable'}
        />
        <Metric label="Elevation" value={units.system === 'metric' ? Math.round(weather.elevation) : Math.round(weather.elevation * 3.28084)} unit={units.system === 'metric' ? 'm' : 'ft'} />
        <Metric label="Solar radiation" value={nowHour?.rad == null ? '–' : Math.round(nowHour.rad)} unit="W/m²" note="Drives track temperature" />
      </div>
    </section>
  )
}
