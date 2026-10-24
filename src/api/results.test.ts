import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse } from '../test/fixtures'
import { getRoundResults } from './results'

const driver = (code: string | undefined, familyName: string, team = 'Mercedes') => ({
  Driver: { code, givenName: 'Test', familyName },
  Constructor: { name: team },
})

const winner = {
  ...driver('RUS', 'Russell'),
  position: '1',
  positionText: '1',
  points: '25',
  grid: '2',
  laps: '58',
  status: 'Finished',
  Time: { time: '1:23:06.801' },
  FastestLap: { rank: '6' },
}
const pitLane = {
  ...driver('ANT', 'Antonelli'),
  position: '2',
  positionText: '2',
  points: '19',
  grid: '0',
  laps: '58',
  status: 'Finished',
  Time: { time: '+2.974' },
  FastestLap: { rank: '1' },
}
const retired = {
  ...driver(undefined, 'Hülkenberg', 'Audi'),
  position: '22',
  positionText: 'W',
  points: '0',
  grid: '11',
  laps: '0',
  status: 'Did not start',
}
const pole = { ...driver('RUS', 'Russell'), position: '1', Q1: '1:19.507', Q2: '1:18.934', Q3: '1:18.518' }
const outInQ1 = { ...driver('BOT', 'Bottas', 'Cadillac F1 Team'), position: '19', Q1: '1:23.244' }

const table = (key: string, lines: unknown[] | null) =>
  jsonResponse({ MRData: { RaceTable: { Races: lines ? [{ round: '1', [key]: lines }] : [] } } })

function stubApi(over: Partial<Record<'results' | 'sprint' | 'qualifying', Response>> = {}) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/results.json')) return Promise.resolve(over.results ?? table('Results', [winner, pitLane, retired]))
    if (url.includes('/sprint.json')) return Promise.resolve(over.sprint ?? table('SprintResults', null))
    if (url.includes('/qualifying.json')) return Promise.resolve(over.qualifying ?? table('QualifyingResults', [pole, outInQ1]))
    return Promise.reject(new Error(`unexpected ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe('getRoundResults', () => {
  it('requests the three classifications for the round', async () => {
    const fetchMock = stubApi()
    await getRoundResults('2026', 1)
    const urls = fetchMock.mock.calls.map(([url]) => url)
    expect(urls).toHaveLength(3)
    for (const path of ['results', 'sprint', 'qualifying']) {
      expect(urls).toContain(`https://api.jolpi.ca/ergast/f1/2026/1/${path}.json?limit=100`)
    }
  })

  it('turns a race classification into rows', async () => {
    stubApi()
    const { race } = await getRoundResults('2026', 1)
    expect(race).toEqual([
      { code: 'RUS', name: 'Test Russell', team: 'Mercedes', pos: '1', grid: 2, gained: 1, result: '1:23:06.801', points: 25, fastestLap: false },
      { code: 'ANT', name: 'Test Antonelli', team: 'Mercedes', pos: '2', grid: null, gained: null, result: '+2.974', points: 19, fastestLap: true },
      { code: 'HÜL', name: 'Test Hülkenberg', team: 'Audi', pos: 'W', grid: 11, gained: null, result: 'Did not start', points: 0, fastestLap: false },
    ])
  })

  it('shows lapped cars by laps down instead of their own last-lap gap', async () => {
    const lapped = (laps: string) => ({ ...winner, position: '9', positionText: '9', laps, status: 'Lapped', Time: { time: '+11.673' } })
    stubApi({ results: table('Results', [winner, lapped('57'), lapped('55')]) })
    const { race } = await getRoundResults('2026', 1)
    expect(race!.map((r) => r.result)).toEqual(['1:23:06.801', '+1 Lap', '+3 Laps'])
  })

  it('keeps only the qualifying segments a driver reached', async () => {
    stubApi()
    const { quali } = await getRoundResults('2026', 1)
    expect(quali).toEqual([
      { code: 'RUS', name: 'Test Russell', team: 'Mercedes', pos: 1, q1: '1:19.507', q2: '1:18.934', q3: '1:18.518' },
      { code: 'BOT', name: 'Test Bottas', team: 'Cadillac F1 Team', pos: 19, q1: '1:23.244', q2: null, q3: null },
    ])
  })

  it('returns null for sessions without a classification', async () => {
    stubApi({ results: table('Results', null) })
    const res = await getRoundResults('2026', 1)
    expect(res.race).toBeNull()
    expect(res.sprint).toBeNull()
    expect(res.quali).toHaveLength(2)
  })

  it('reads a sprint classification', async () => {
    stubApi({ sprint: table('SprintResults', [{ ...winner, points: '8' }]) })
    const { sprint } = await getRoundResults('2026', 1)
    expect(sprint).toHaveLength(1)
    expect(sprint![0].points).toBe(8)
  })

  it('rejects when any request fails', async () => {
    stubApi({ qualifying: jsonResponse({}, 404) })
    await expect(getRoundResults('2026', 1)).rejects.toThrow('The F1 results service responded with error 404')
  })

  it('rejects a response in an unexpected shape', async () => {
    stubApi({ results: jsonResponse({ MRData: { RaceTable: { Races: [{ round: '1' }] } } }) })
    await expect(getRoundResults('2026', 1)).rejects.toThrow('The F1 results service sent data in an unexpected format')
  })
})
