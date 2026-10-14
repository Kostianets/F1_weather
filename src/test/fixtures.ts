import type { Hour } from '../types'

const HOUR = 3_600_000

/** A forecast hour with mild, dry, calm defaults. */
export function hour(t: number, over: Partial<Hour> = {}): Hour {
  return {
    t,
    temp: 20,
    feels: 20,
    rh: 50,
    dew: 9,
    pop: 0,
    precip: 0,
    code: 0,
    pressure: 1013,
    cloud: 0,
    cloudLow: 0,
    cloudMid: 0,
    cloudHigh: 0,
    vis: 20000,
    wind: 10,
    windDir: 180,
    gust: 20,
    uv: 3,
    isDay: true,
    rad: 0,
    trackTemp: null,
    trackState: 'dry',
    ...over,
  }
}

export function hours(start: number, count: number, over: (i: number) => Partial<Hour> = () => ({})): Hour[] {
  return Array.from({ length: count }, (_, i) => hour(start + i * HOUR, over(i)))
}

/** An Open-Meteo forecast response in unixtime format, starting a day before `from`, covering 17 days. */
export function openMeteoResponse(from: number) {
  const start = Math.floor(from / 86_400_000) * 86_400_000 - 86_400_000
  const nHours = 17 * 24
  const times = Array.from({ length: nHours }, (_, i) => (start + i * HOUR) / 1000)
  const fill = (v: number) => times.map(() => v)
  const days = Array.from({ length: 17 }, (_, i) => (start + i * 86_400_000) / 1000)
  const dfill = (v: number) => days.map(() => v)
  return {
    timezone: 'UTC',
    timezone_abbreviation: 'UTC',
    elevation: 100,
    current: {
      time: Math.floor(from / 1000),
      temperature_2m: 21,
      relative_humidity_2m: 55,
      apparent_temperature: 22,
      is_day: 1,
      precipitation: 0,
      weather_code: 1,
      cloud_cover: 20,
      pressure_msl: 1012,
      wind_speed_10m: 12,
      wind_direction_10m: 200,
      wind_gusts_10m: 25,
    },
    hourly: {
      time: times,
      temperature_2m: fill(21),
      relative_humidity_2m: fill(55),
      dew_point_2m: fill(11),
      apparent_temperature: fill(22),
      precipitation_probability: fill(10),
      precipitation: fill(0),
      weather_code: fill(1),
      pressure_msl: fill(1012),
      cloud_cover: fill(20),
      cloud_cover_low: fill(5),
      cloud_cover_mid: fill(10),
      cloud_cover_high: fill(15),
      visibility: fill(24000),
      wind_speed_10m: fill(12),
      wind_direction_10m: fill(200),
      wind_gusts_10m: fill(25),
      uv_index: fill(4),
      is_day: fill(1),
      shortwave_radiation: fill(500),
    },
    daily: {
      time: days,
      weather_code: dfill(1),
      temperature_2m_max: dfill(25),
      temperature_2m_min: dfill(15),
      sunrise: days.map((d) => d + 6 * 3600),
      sunset: days.map((d) => d + 18 * 3600),
      uv_index_max: dfill(6),
      precipitation_sum: dfill(0),
      precipitation_probability_max: dfill(10),
      wind_speed_10m_max: dfill(20),
      wind_gusts_10m_max: dfill(35),
      wind_direction_10m_dominant: dfill(200),
    },
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
