import { expect, getJson } from './http'
import { API } from './schedule'
import type { DriverStanding, StandingsTable, TeamStanding } from '../types'

const SERVICE = 'The F1 standings service'

interface ApiLine {
  position?: string
  points: string
  wins: string
}

interface ApiDriverLine extends ApiLine {
  Driver: { code?: string; givenName: string; familyName: string }
  Constructors: { name: string }[]
}

interface ApiTeamLine extends ApiLine {
  Constructor: { constructorId: string; name: string }
}

interface ApiList {
  round: string
  DriverStandings?: ApiDriverLine[]
  ConstructorStandings?: ApiTeamLine[]
}

interface ApiStandings {
  MRData?: { StandingsTable?: { StandingsLists?: ApiList[] } }
}

/** The season's latest standings list, or null before its first classified session. */
async function latestList(season: string, kind: 'driver' | 'constructor'): Promise<ApiList | null> {
  const json = await getJson<ApiStandings>(`${API}/${season}/${kind}standings.json?limit=100`, SERVICE, 8000)
  const lists = json.MRData?.StandingsTable?.StandingsLists
  expect(Array.isArray(lists), SERVICE)
  if (lists.length === 0) return null
  expect(Number(lists[0].round) > 0, SERVICE)
  return lists[0]
}

const standing = (l: ApiLine, i: number) => ({
  // Entries excluded from the championship come without a position.
  pos: Number(l.position) || i + 1,
  points: Number(l.points),
  wins: Number(l.wins),
})

export async function getDriverStandings(season: string): Promise<StandingsTable<DriverStanding> | null> {
  const list = await latestList(season, 'driver')
  if (!list) return null
  const lines = list.DriverStandings
  expect(Array.isArray(lines), SERVICE)
  expect(lines.every((l) => l.Driver && Array.isArray(l.Constructors) && !Number.isNaN(Number(l.points))), SERVICE)
  return {
    round: Number(list.round),
    rows: lines.map((l, i) => ({
      code: l.Driver.code ?? l.Driver.familyName.slice(0, 3).toUpperCase(),
      name: `${l.Driver.givenName} ${l.Driver.familyName}`,
      // A driver who changed teams is listed with every team, the latest last.
      team: l.Constructors.at(-1)?.name ?? '–',
      ...standing(l, i),
    })),
  }
}

export async function getTeamStandings(season: string): Promise<StandingsTable<TeamStanding> | null> {
  const list = await latestList(season, 'constructor')
  if (!list) return null
  const lines = list.ConstructorStandings
  expect(Array.isArray(lines), SERVICE)
  expect(lines.every((l) => l.Constructor?.constructorId && !Number.isNaN(Number(l.points))), SERVICE)
  return {
    round: Number(list.round),
    rows: lines.map((l, i) => ({ id: l.Constructor.constructorId, name: l.Constructor.name, ...standing(l, i) })),
  }
}
