import { applyTrackModel } from '../lib/track'
import { expect, getJson } from './http'
import type { AirQuality, Current, Day, Hour, Weather } from '../types'

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'

/** Open-Meteo forecasts reach this far ahead. */
export const FORECAST_DAYS = 16

const CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
]

const HOURLY = [
  'temperature_2m',
  'relative_humidity_2m',
  'dew_point_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'pressure_msl',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
  'shortwave_radiation',
]

const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
]

type Column = (number | null)[]
type Table = Record<string, Column>

const sec = (v: number | null) => (v == null ? null : v * 1000)

export async function getWeather(lat: number, lon: number): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '1', // lets the track model know about rain that already fell
    forecast_days: String(FORECAST_DAYS),
  })
  // Open-Meteo can take several seconds under load; the default 12 s is too tight for this big request.
  const json = await getJson<any>(`${FORECAST}?${params}`, 'The weather service', 20_000)
  expect(Array.isArray(json?.hourly?.time) && Array.isArray(json?.daily?.time) && json?.current, 'The weather service')

  const h = json.hourly as Table
  const hours: Hour[] = h.time.map((t, i) => ({
    t: t! * 1000,
    temp: h.temperature_2m[i],
    feels: h.apparent_temperature[i],
    rh: h.relative_humidity_2m[i],
    dew: h.dew_point_2m[i],
    pop: h.precipitation_probability[i],
    precip: h.precipitation[i],
    code: h.weather_code[i],
    pressure: h.pressure_msl[i],
    cloud: h.cloud_cover[i],
    cloudLow: h.cloud_cover_low[i],
    cloudMid: h.cloud_cover_mid[i],
    cloudHigh: h.cloud_cover_high[i],
    vis: h.visibility[i],
    wind: h.wind_speed_10m[i],
    windDir: h.wind_direction_10m[i],
    gust: h.wind_gusts_10m[i],
    uv: h.uv_index[i],
    isDay: h.is_day[i] === 1,
    rad: h.shortwave_radiation[i],
    trackTemp: null,
    trackState: 'dry',
  }))
  applyTrackModel(hours)

  const d = json.daily as Table
  const days: Day[] = d.time.map((t, i) => ({
    t: t! * 1000,
    code: d.weather_code[i],
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    sunrise: sec(d.sunrise[i]),
    sunset: sec(d.sunset[i]),
    uvMax: d.uv_index_max[i],
    precip: d.precipitation_sum[i],
    popMax: d.precipitation_probability_max[i],
    windMax: d.wind_speed_10m_max[i],
    gustMax: d.wind_gusts_10m_max[i],
    windDir: d.wind_direction_10m_dominant[i],
  }))

  const c = json.current
  const current: Current = {
    t: c.time * 1000,
    temp: c.temperature_2m,
    feels: c.apparent_temperature,
    rh: c.relative_humidity_2m,
    precip: c.precipitation,
    code: c.weather_code,
    cloud: c.cloud_cover,
    pressure: c.pressure_msl,
    wind: c.wind_speed_10m,
    windDir: c.wind_direction_10m,
    gust: c.wind_gusts_10m,
    isDay: c.is_day === 1,
  }

  return {
    timezone: json.timezone,
    tzAbbr: json.timezone_abbreviation,
    elevation: json.elevation,
    fetchedAt: Date.now(),
    current,
    hours,
    days,
  }
}

export async function getAirQuality(lat: number, lon: number): Promise<AirQuality> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'us_aqi,pm2_5,pm10,ozone',
  })
  const c = (await getJson<any>(`${AIR}?${params}`, 'The air quality service')).current
  expect(c, 'The air quality service')
  return { usAqi: c.us_aqi, pm25: c.pm2_5, pm10: c.pm10, ozone: c.ozone }
}
