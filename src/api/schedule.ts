import fallbackSeason from '../data/season-fallback.json'
import { expect, getJson } from './http'
import type { NextRace, Race, Session, SessionKey } from '../types'

const API = 'https://api.jolpi.ca/ergast/f1'
const MIN = 60_000

interface ApiSlot {
  date: string
  time?: string
}

export interface ApiRace extends ApiSlot {
  season: string
  round: string
  raceName: string
  Circuit: {
    circuitId: string
    circuitName: string
    Location: { lat: string; long: string; locality: string; country: string }
  }
  FirstPractice?: ApiSlot
  SecondPractice?: ApiSlot
  ThirdPractice?: ApiSlot
  SprintQualifying?: ApiSlot
  Sprint?: ApiSlot
  Qualifying?: ApiSlot
}

// The API only gives start times; these are the assumed slot lengths. The race gets
// the full 3-hour window the rules allow (suspensions included), so a delayed race
// still counts as live instead of finishing on paper while cars are running.
const SLOTS: { key: SessionKey; field: keyof ApiRace | null; name: string; short: string; minutes: number }[] = [
  { key: 'fp1', field: 'FirstPractice', name: 'Practice 1', short: 'FP1', minutes: 60 },
  { key: 'fp2', field: 'SecondPractice', name: 'Practice 2', short: 'FP2', minutes: 60 },
  { key: 'fp3', field: 'ThirdPractice', name: 'Practice 3', short: 'FP3', minutes: 60 },
  { key: 'sprintQuali', field: 'SprintQualifying', name: 'Sprint Qualifying', short: 'SQ', minutes: 45 },
  { key: 'sprint', field: 'Sprint', name: 'Sprint', short: 'SPR', minutes: 60 },
  { key: 'quali', field: 'Qualifying', name: 'Qualifying', short: 'Q', minutes: 60 },
  { key: 'race', field: null, name: 'Race', short: 'RACE', minutes: 180 },
]

function slotStart(slot: ApiSlot): number {
  return Date.parse(`${slot.date}T${slot.time ?? '12:00:00Z'}`)
}

export function toRace(r: ApiRace): Race {
  const sessions: Session[] = []
  for (const s of SLOTS) {
    const slot = s.field ? (r[s.field] as ApiSlot | undefined) : r
    if (!slot) continue
    const start = slotStart(slot)
    if (Number.isNaN(start)) continue
    sessions.push({ key: s.key, name: s.name, short: s.short, start, end: start + s.minutes * MIN })
  }
  sessions.sort((a, b) => a.start - b.start)
  return {
    season: r.season,
    round: Number(r.round),
    name: r.raceName,
    circuitId: r.Circuit.circuitId,
    circuitName: r.Circuit.circuitName,
    locality: r.Circuit.Location.locality,
    country: r.Circuit.Location.country,
    lat: Number(r.Circuit.Location.lat),
    lon: Number(r.Circuit.Location.long),
    sessions,
  }
}

async function fetchSeason(season: string): Promise<Race[]> {
  const json = await getJson<{ MRData?: { RaceTable?: { Races?: ApiRace[] } } }>(
    `${API}/${season}.json?limit=100`,
    'The F1 calendar service',
    8000,
  )
  const races = json.MRData?.RaceTable?.Races
  expect(Array.isArray(races), 'The F1 calendar service')
  return races.map(toRace)
}

function raceEnd(race: Race): number {
  return race.sessions[race.sessions.length - 1].end
}

export function pickNext(races: Race[], now: number): Race | undefined {
  return races.filter((r) => r.sessions.length > 0).find((r) => raceEnd(r) > now)
}

export async function getNextRace(now = Date.now()): Promise<NextRace> {
  try {
    let races = await fetchSeason('current')
    let next = pickNext(races, now)
    if (!next && races.length > 0) {
      // Season is over: the next calendar may already be published.
      const following = await fetchSeason(String(Number(races[0].season) + 1)).catch(() => [])
      const upcoming = pickNext(following, now)
      if (upcoming) {
        races = following
        next = upcoming
      }
    }
    if (races.length === 0) throw new Error('Schedule API returned no races')
    return {
      race: next ?? races[races.length - 1],
      races,
      source: 'live',
      finished: !next,
    }
  } catch (err) {
    console.warn('Live schedule unavailable, using bundled calendar', err)
    const races = (fallbackSeason as ApiRace[]).map(toRace)
    const next = pickNext(races, now)
    return {
      race: next ?? races[races.length - 1],
      races,
      source: 'bundled',
      finished: !next,
    }
  }
}

// Picks what to show after a calendar refresh. Keeps the current object when nothing
// changed, so effects keyed on the race don't refetch, and never trades a live
// calendar for the bundled one because of a single failed refresh.
export function mergeNext(prev: NextRace | null, fresh: NextRace): NextRace {
  if (!prev) return fresh
  if (prev.source === 'live' && fresh.source === 'bundled') return prev
  return JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh
}
