import { expect, getJson } from './http'

const HOUR = 3_600_000

export interface RadarFrame {
  t: number
  url: string
}

/** Observed rain radar frames (about the last two hours) from RainViewer. */
export async function getRadarFrames(): Promise<RadarFrame[]> {
  const json = await getJson<{ host?: string; radar?: { past?: unknown } }>(
    'https://api.rainviewer.com/public/weather-maps.json',
    'The radar service',
  )
  expect(json.host && Array.isArray(json.radar?.past), 'The radar service')
  return (json.radar!.past as { time: number; path: string }[]).map((f) => ({
    t: f.time * 1000,
    url: `${json.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
  }))
}

// Wider than tall, to match the shape of the map.
export const GRID_COLS = 11
export const GRID_ROWS = 7
const LAT_STEP = 0.5

export type GridField = 'cloud' | 'precip' | 'temp' | 'wind' | 'windDir' | 'pressure'

export interface Grid {
  key: string
  lats: number[] // north to south
  lons: number[] // west to east
  latStep: number
  lonStep: number
  times: number[]
  /** fields[name][timeIndex][row * GRID_COLS + col] */
  fields: Record<GridField, (number | null)[][]>
}

const VARS: Record<GridField, string> = {
  cloud: 'cloud_cover',
  precip: 'precipitation',
  temp: 'temperature_2m',
  wind: 'wind_speed_10m',
  windDir: 'wind_direction_10m',
  pressure: 'pressure_msl',
}

const isoHour = (t: number) => new Date(t).toISOString().slice(0, 13) + ':00'

/** Hourly model forecast on a grid of points around the track, for the map overlays. */
export async function getGrid(lat: number, lon: number, from: number, to: number): Promise<Grid> {
  // Widen the longitude step with latitude so cells stay square on the map.
  const lonStep = LAT_STEP / Math.cos((lat * Math.PI) / 180)
  const lats = Array.from({ length: GRID_ROWS }, (_, i) => lat + ((GRID_ROWS - 1) / 2 - i) * LAT_STEP)
  const lons = Array.from({ length: GRID_COLS }, (_, i) => lon + (i - (GRID_COLS - 1) / 2) * lonStep)
  const pointLats: string[] = []
  const pointLons: string[] = []
  for (const la of lats) {
    for (const lo of lons) {
      pointLats.push(la.toFixed(3))
      pointLons.push(lo.toFixed(3))
    }
  }

  const start = Math.floor(from / HOUR) * HOUR
  const params = new URLSearchParams({
    latitude: pointLats.join(','),
    longitude: pointLons.join(','),
    hourly: Object.values(VARS).join(','),
    timezone: 'GMT',
    timeformat: 'unixtime',
    start_hour: isoHour(start),
    end_hour: isoHour(to),
  })
  const points = await getJson<{ hourly: Record<string, (number | null)[]> }[]>(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    'The map forecast service',
    20_000,
  )
  expect(Array.isArray(points) && points.length === lats.length * lons.length && points[0].hourly?.time, 'The map forecast service')

  const times = points[0].hourly.time.map((t) => t! * 1000)
  const fields = {} as Grid['fields']
  for (const [field, name] of Object.entries(VARS) as [GridField, string][]) {
    fields[field] = times.map((_, ti) => points.map((p) => p.hourly[name][ti]))
  }
  return { key: `${lat},${lon},${start},${to}`, lats, lons, latStep: LAT_STEP, lonStep, times, fields }
}
