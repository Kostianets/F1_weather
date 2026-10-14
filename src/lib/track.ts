import circuits from '../data/circuits.json'
import type { Hour, Session, SessionForecast, TrackState } from '../types'

const HOUR = 3_600_000

/**
 * Rough asphalt surface temperature. Sun heats the track well above air
 * temperature, wind and standing water pull it back towards it. This is an
 * estimate from forecast data, not a measurement.
 */
export function estimateTrackTemp(air: number, rad: number, radPrev: number, windKmh: number, wet: boolean): number {
  const heating = 0.65 * rad + 0.35 * radPrev // asphalt lags the sun
  const cooling = 1 + windKmh / 36
  let delta = Math.max(1.5, (0.032 * heating) / cooling)
  if (wet) delta *= 0.3
  return air + delta
}

/** Fills in trackTemp and trackState on each hour, carrying surface water forward in time. */
export function applyTrackModel(hours: Hour[]): void {
  let water = 0 // mm standing on the surface
  let radPrev = 0
  for (const h of hours) {
    const rad = h.rad ?? 0
    const wind = h.wind ?? 0
    const precip = h.precip ?? 0
    const evaporation = 0.25 + rad / 350 + wind / 50
    // Anything beyond a thin film runs off rather than piling up.
    water = Math.min(1.5, Math.max(0, water + precip - evaporation))
    const state: TrackState = water > 0.4 || precip >= 0.5 ? 'wet' : water > 0 || precip > 0 ? 'damp' : 'dry'
    h.trackState = state
    h.trackTemp = h.temp == null ? null : estimateTrackTemp(h.temp, rad, radPrev, wind, state !== 'dry')
    radPrev = rad
  }
}

function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

function max(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null)
  return v.length ? Math.max(...v) : null
}

function meanDirection(hours: Hour[]): number | null {
  let x = 0
  let y = 0
  let n = 0
  for (const h of hours) {
    if (h.windDir == null) continue
    const w = h.wind ?? 1
    x += Math.sin((h.windDir * Math.PI) / 180) * w
    y += Math.cos((h.windDir * Math.PI) / 180) * w
    n++
  }
  if (!n) return null
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
}

const STATE_RANK: Record<TrackState, number> = { dry: 0, damp: 1, wet: 2 }

/** Summarises the forecast hours a session overlaps. Null when it is outside the forecast range. */
export function sessionForecast(hours: Hour[], session: Session): SessionForecast | null {
  const from = Math.floor(session.start / HOUR) * HOUR
  const slice = hours.filter((h) => h.t >= from && h.t < session.end && h.temp != null)
  if (slice.length === 0) return null
  const worst = slice.reduce((a, b) => (STATE_RANK[b.trackState] > STATE_RANK[a.trackState] ? b : a))
  return {
    temp: mean(slice.map((h) => h.temp))!,
    trackTemp: mean(slice.map((h) => h.trackTemp)),
    pop: max(slice.map((h) => h.pop)),
    precip: slice.reduce((a, h) => a + (h.precip ?? 0), 0),
    wind: mean(slice.map((h) => h.wind)),
    gust: max(slice.map((h) => h.gust)),
    windDir: meanDirection(slice),
    cloud: mean(slice.map((h) => h.cloud)),
    rh: mean(slice.map((h) => h.rh)),
    code: max(slice.map((h) => h.code)),
    isDay: slice[Math.floor(slice.length / 2)].isDay,
    trackState: worst.trackState,
  }
}

export function hourAt(hours: Hour[], t: number): Hour | undefined {
  if (hours.length === 0) return undefined
  return hours[Math.floor((t - hours[0].t) / HOUR)]
}

/** Circuit outline as [lon, lat] pairs, when we have one for this circuit. */
export function circuitOutline(circuitId: string): [number, number][] | null {
  return (circuits as unknown as Record<string, [number, number][]>)[circuitId] ?? null
}

function bearing(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return ((Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI + 360) % 360
}

function metres(a: [number, number], b: [number, number]): number {
  const k = Math.cos((a[1] * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111_320
}

function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

export interface Straight {
  from: number
  to: number
  bearing: number
  length: number
}

/** Longest run of the outline that stays within a few degrees of one heading. */
export function longestStraight(outline: [number, number][]): Straight | null {
  let best: Straight | null = null
  for (let i = 0; i < outline.length - 1; i++) {
    const heading = bearing(outline[i], outline[i + 1])
    let j = i + 1
    while (j < outline.length - 1 && angleDiff(bearing(outline[i], outline[j + 1]), heading) < 5) j++
    const length = metres(outline[i], outline[j])
    if (!best || length > best.length) best = { from: i, to: j, bearing: bearing(outline[i], outline[j]), length }
  }
  return best
}

/** Splits wind into the part along a straight and the part across it. */
export function windOnStraight(speed: number, fromDir: number, straightBearing: number) {
  const rel = ((fromDir - straightBearing) * Math.PI) / 180
  return { along: Math.abs(speed * Math.cos(rel)), across: Math.abs(speed * Math.sin(rel)) }
}
