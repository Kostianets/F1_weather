import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../test/fixtures'
import { getDriverStandings, getTeamStandings } from './standings'

const line = (code: string | undefined, familyName: string, points: string, teams = ['Mercedes'], position: string | null = '1') => ({
  ...(position && { position }),
  points,
  wins: '2',
  Driver: { code, givenName: 'Test', familyName },
  Constructors: teams.map((name) => ({ name })),
})

const stub = (body: unknown) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(body))))
const lists = (l: unknown[]) => ({ MRData: { StandingsTable: { StandingsLists: l } } })

afterEach(() => vi.unstubAllGlobals())

describe('getDriverStandings', () => {
  it('reads the round and each driver', async () => {
    stub(lists([{ round: '18', DriverStandings: [line('ANT', 'Antonelli', '365'), line(undefined, 'Hülkenberg', '12.5', ['Sauber', 'Audi'], null)] }]))
    expect(await getDriverStandings('2026')).toEqual({
      round: 18,
      rows: [
        { code: 'ANT', name: 'Test Antonelli', team: 'Mercedes', pos: 1, points: 365, wins: 2 },
        { code: 'HÜL', name: 'Test Hülkenberg', team: 'Audi', pos: 2, points: 12.5, wins: 2 },
      ],
    })
  })

  it('returns null before the season has standings', async () => {
    stub(lists([]))
    expect(await getDriverStandings('2027')).toBeNull()
  })

  it('rejects a response in an unexpected format', async () => {
    stub({ MRData: {} })
    await expect(getDriverStandings('2026')).rejects.toThrow('unexpected format')
    stub(lists([{ round: '18', DriverStandings: [{ points: 'x' }] }]))
    await expect(getDriverStandings('2026')).rejects.toThrow('unexpected format')
  })
})

describe('getTeamStandings', () => {
  const team = (constructorId: string, name: string, points: string, position = '1') => ({ position, points, wins: '3', Constructor: { constructorId, name } })

  it('reads the round and each team', async () => {
    stub(lists([{ round: '19', ConstructorStandings: [team('mercedes', 'Mercedes', '607'), team('red_bull', 'Red Bull', '355', '3')] }]))
    expect(await getTeamStandings('2026')).toEqual({
      round: 19,
      rows: [
        { id: 'mercedes', name: 'Mercedes', pos: 1, points: 607, wins: 3 },
        { id: 'red_bull', name: 'Red Bull', pos: 3, points: 355, wins: 3 },
      ],
    })
  })

  it('rejects a response in an unexpected format', async () => {
    stub(lists([{ round: '19', ConstructorStandings: [{ points: '1', Constructor: {} }] }]))
    await expect(getTeamStandings('2026')).rejects.toThrow('unexpected format')
  })
})
