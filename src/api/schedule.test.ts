import { afterEach, describe, expect, it, vi } from 'vitest'
import fallbackSeason from '../data/season-fallback.json'
import { jsonResponse } from '../test/fixtures'
import { getNextRace, pickNext, toRace } from './schedule'
import type { ApiRace } from './schedule'

const season = fallbackSeason as ApiRace[]
const races = season.map(toRace)
const calendar = (list: ApiRace[]) => jsonResponse({ MRData: { RaceTable: { Races: list } } })

afterEach(() => vi.unstubAllGlobals())

describe('toRace', () => {
  it('builds a standard weekend in session order', () => {
    const australia = races[0]
    expect(australia.sessions.map((s) => s.key)).toEqual(['fp1', 'fp2', 'fp3', 'quali', 'race'])
    expect(australia.lat).toBeCloseTo(-37.8497)
    expect(australia.sessions[4].start).toBe(Date.parse('2026-03-08T04:00:00Z'))
    expect(australia.sessions[4].end - australia.sessions[4].start).toBe(120 * 60_000)
  })

  it('orders a sprint weekend by start time, not by field order', () => {
    const china = races[1]
    expect(china.sessions.map((s) => s.key)).toEqual(['fp1', 'sprintQuali', 'sprint', 'quali', 'race'])
    expect(china.sessions.find((s) => s.key === 'sprintQuali')!.end - china.sessions[1].start).toBe(45 * 60_000)
  })

  it('assumes midday UTC when a session has no time', () => {
    const race = toRace({ ...season[0], time: undefined })
    expect(race.sessions.at(-1)!.start).toBe(Date.parse('2026-03-08T12:00:00Z'))
  })
})

describe('pickNext', () => {
  it('returns the first race that has not finished', () => {
    expect(pickNext(races, Date.parse('2026-10-14T00:00:00Z'))!.name).toBe('United States Grand Prix')
  })

  it('keeps showing a race until its last session ends', () => {
    const duringRace = Date.parse('2026-10-25T21:00:00Z')
    expect(pickNext(races, duringRace)!.name).toBe('United States Grand Prix')
  })

  it('returns nothing once the season is over', () => {
    expect(pickNext(races, Date.parse('2027-01-01T00:00:00Z'))).toBeUndefined()
  })
})

describe('getNextRace', () => {
  it('uses the live calendar when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(calendar(season)))
    const next = await getNextRace(Date.parse('2026-10-14T00:00:00Z'))
    expect(next.source).toBe('live')
    expect(next.race.name).toBe('United States Grand Prix')
    expect(next.totalRounds).toBe(23)
  })

  it('falls back to the bundled calendar when the service is down', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const next = await getNextRace(Date.parse('2026-10-14T00:00:00Z'))
    expect(next.source).toBe('bundled')
    expect(next.race.name).toBe('United States Grand Prix')
  })

  it('falls back when the service sends something unexpected', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' })))
    expect((await getNextRace(Date.parse('2026-10-14T00:00:00Z'))).source).toBe('bundled')
  })

  it('looks at next season once this one is over', async () => {
    const next2027 = { ...season[0], season: '2027', date: '2027-03-07', FirstPractice: { date: '2027-03-05', time: '01:30:00Z' } }
    const fetch = vi.fn((url: string) => Promise.resolve(calendar(url.includes('/2027.') ? [next2027] : season)))
    vi.stubGlobal('fetch', fetch)
    const next = await getNextRace(Date.parse('2027-01-01T00:00:00Z'))
    expect(next.race.season).toBe('2027')
    expect(next.finished).toBe(false)
  })

  it('shows the last race of the season when no next calendar exists yet', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('/2027.') ? calendar([]) : calendar(season))))
    const next = await getNextRace(Date.parse('2027-01-01T00:00:00Z'))
    expect(next.race.name).toBe('Abu Dhabi Grand Prix')
    expect(next.finished).toBe(true)
  })
})
