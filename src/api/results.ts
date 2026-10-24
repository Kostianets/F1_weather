import { expect, getJson } from './http'
import { API } from './schedule'
import type { Driver, QualiResult, RaceResult, RoundResults } from '../types'

const SERVICE = 'The F1 results service'

interface ApiDriverLine {
  position: string
  Driver: { code?: string; givenName: string; familyName: string }
  Constructor: { name: string }
}

interface ApiRaceLine extends ApiDriverLine {
  positionText: string
  points: string
  grid: string
  laps: string
  status: string
  Time?: { time: string }
  FastestLap?: { rank?: string }
}

interface ApiQualiLine extends ApiDriverLine {
  Q1?: string
  Q2?: string
  Q3?: string
}

type Table<K extends string, L> = { MRData?: { RaceTable?: { Races?: (Record<K, L[] | undefined>)[] } } }

// Each endpoint returns no race until that session has a classification.
async function fetchTable<K extends string, L extends ApiDriverLine>(season: string, round: number, path: string, key: K): Promise<L[] | null> {
  const json = await getJson<Table<K, L>>(`${API}/${season}/${round}/${path}.json?limit=100`, SERVICE, 8000)
  const races = json.MRData?.RaceTable?.Races
  expect(Array.isArray(races), SERVICE)
  if (races.length === 0) return null
  const lines = races[0][key]
  expect(Array.isArray(lines), SERVICE)
  expect(lines.every((l) => l.Driver && l.Constructor && l.position), SERVICE)
  return lines
}

function toDriver(l: ApiDriverLine): Driver {
  const { code, givenName, familyName } = l.Driver
  return {
    code: code ?? familyName.slice(0, 3).toUpperCase(),
    name: `${givenName} ${familyName}`,
    team: l.Constructor.name,
  }
}

// Lapped cars come with a time measured on their own last lap, which reads like a gap
// to the winner, so they're shown by laps down instead.
function resultText(l: ApiRaceLine, leaderLaps: number): string {
  const down = leaderLaps - Number(l.laps)
  if (l.status === 'Lapped' && down > 0) return `+${down} Lap${down > 1 ? 's' : ''}`
  return l.Time?.time ?? l.status
}

function toRaceResult(l: ApiRaceLine, leaderLaps: number): RaceResult {
  const grid = Number(l.grid) || null
  const classified = /^\d+$/.test(l.positionText)
  return {
    ...toDriver(l),
    pos: l.positionText,
    grid,
    gained: classified && grid != null ? grid - Number(l.positionText) : null,
    result: resultText(l, leaderLaps),
    points: Number(l.points),
    fastestLap: l.FastestLap?.rank === '1',
  }
}

function toQualiResult(l: ApiQualiLine): QualiResult {
  return { ...toDriver(l), pos: Number(l.position), q1: l.Q1 || null, q2: l.Q2 || null, q3: l.Q3 || null }
}

export async function getRoundResults(season: string, round: number): Promise<RoundResults> {
  const [race, sprint, quali] = await Promise.all([
    fetchTable<'Results', ApiRaceLine>(season, round, 'results', 'Results'),
    fetchTable<'SprintResults', ApiRaceLine>(season, round, 'sprint', 'SprintResults'),
    fetchTable<'QualifyingResults', ApiQualiLine>(season, round, 'qualifying', 'QualifyingResults'),
  ])
  const classify = (lines: ApiRaceLine[]) => lines.map((l) => toRaceResult(l, Number(lines[0]?.laps)))
  return {
    race: race && classify(race),
    sprint: sprint && classify(sprint),
    quali: quali && quali.map(toQualiResult),
  }
}
