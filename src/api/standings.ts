import { expect, getJson } from './http'
import { API } from './schedule'
import type { DriverStandings } from '../types'

const SERVICE = 'The F1 standings service'

interface ApiStanding {
  position?: string
  points: string
  wins: string
  Driver: { code?: string; givenName: string; familyName: string }
  Constructors: { name: string }[]
}

interface ApiStandings {
  MRData?: { StandingsTable?: { StandingsLists?: { round: string; DriverStandings?: ApiStanding[] }[] } }
}

/** The latest drivers' standings of a season, or null before its first classified session. */
export async function getDriverStandings(season: string): Promise<DriverStandings | null> {
  const json = await getJson<ApiStandings>(`${API}/${season}/driverstandings.json?limit=100`, SERVICE, 8000)
  const lists = json.MRData?.StandingsTable?.StandingsLists
  expect(Array.isArray(lists), SERVICE)
  if (lists.length === 0) return null
  const { round, DriverStandings: lines } = lists[0]
  expect(Array.isArray(lines) && Number(round) > 0, SERVICE)
  expect(lines.every((l) => l.Driver && Array.isArray(l.Constructors) && !Number.isNaN(Number(l.points))), SERVICE)
  return {
    round: Number(round),
    drivers: lines.map((l, i) => ({
      code: l.Driver.code ?? l.Driver.familyName.slice(0, 3).toUpperCase(),
      name: `${l.Driver.givenName} ${l.Driver.familyName}`,
      // A driver who changed teams is listed with every team, the latest last.
      team: l.Constructors.at(-1)?.name ?? '–',
      // Drivers excluded from the championship come without a position.
      pos: Number(l.position) || i + 1,
      points: Number(l.points),
      wins: Number(l.wins),
    })),
  }
}
