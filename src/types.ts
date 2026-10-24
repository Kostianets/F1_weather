export type SessionKey = 'fp1' | 'fp2' | 'fp3' | 'sprintQuali' | 'sprint' | 'quali' | 'race'

export interface Session {
  key: SessionKey
  name: string
  short: string
  /** epoch ms */
  start: number
  end: number
}

export interface Race {
  season: string
  round: number
  name: string
  circuitId: string
  circuitName: string
  locality: string
  country: string
  lat: number
  lon: number
  sessions: Session[]
}

export interface NextRace {
  race: Race
  /** the whole season the race belongs to, in round order */
  races: Race[]
  source: 'live' | 'bundled'
  /** true when no upcoming race could be found and the last known one is shown */
  finished: boolean
}

type N = number | null

/** One forecast hour. All values metric: °C, km/h, mm, hPa, m, %. */
export interface Hour {
  t: number
  temp: N
  feels: N
  rh: N
  dew: N
  pop: N
  precip: N
  code: N
  pressure: N
  cloud: N
  cloudLow: N
  cloudMid: N
  cloudHigh: N
  vis: N
  wind: N
  windDir: N
  gust: N
  uv: N
  isDay: boolean
  rad: N
  trackTemp: N
  trackState: TrackState
}

export type TrackState = 'dry' | 'damp' | 'wet'

export interface Day {
  t: number
  code: N
  tMax: N
  tMin: N
  sunrise: N
  sunset: N
  uvMax: N
  precip: N
  popMax: N
  windMax: N
  gustMax: N
  windDir: N
}

export interface Current {
  t: number
  temp: N
  feels: N
  rh: N
  precip: N
  code: N
  cloud: N
  pressure: N
  wind: N
  windDir: N
  gust: N
  isDay: boolean
}

export interface AirQuality {
  usAqi: N
  pm25: N
  pm10: N
  ozone: N
}

export interface Weather {
  timezone: string
  tzAbbr: string
  elevation: number
  fetchedAt: number
  current: Current
  hours: Hour[]
  days: Day[]
}

export interface SessionForecast {
  temp: number
  trackTemp: N
  pop: N
  precip: number
  wind: N
  gust: N
  windDir: N
  cloud: N
  rh: N
  code: N
  isDay: boolean
  trackState: TrackState
}
