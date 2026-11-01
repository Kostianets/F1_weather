// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toRace } from '../api/schedule'
import type { ApiRace } from '../api/schedule'
import fallbackSeason from '../data/season-fallback.json'
import { jsonResponse } from '../test/fixtures'
import type { NextRace } from '../types'
import Standings from './Standings'

const races = (fallbackSeason as ApiRace[]).map(toRace)
const next: NextRace = { race: races[races.length - 1], races, source: 'live', finished: false }

const line = (code: string, points: number) => ({
  position: '1',
  points: String(points),
  wins: '0',
  Driver: { code, givenName: 'Test', familyName: code },
  Constructors: [{ name: 'Mercedes' }],
})
const team = (name: string, points: number) => ({ position: '1', points: String(points), wins: '0', Constructor: { constructorId: name.toLowerCase(), name } })
const list = (round: number, key: string, lines: unknown[]) =>
  jsonResponse({ MRData: { StandingsTable: { StandingsLists: [{ round: String(round), [key]: lines }] } } })

// Drivers and teams are fetched from separate URLs; teams default to an empty season.
const serve = (round: number, drivers: unknown[], teams: unknown[] = []) =>
  vi.fn((url: string) =>
    Promise.resolve(url.includes('constructorstandings') ? list(round, 'ConstructorStandings', teams) : list(round, 'DriverStandings', drivers)),
  )

const raceEnd = (round: number) => races[round - 1].sessions.find((s) => s.key === 'race')!.end
const row = (code: string) => screen.getByText(code).closest('tr')!

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Standings', () => {
  it('marks the drivers who can still win the title', async () => {
    // Only the final race is left: 25 points.
    const last = races.length - 1
    vi.stubGlobal('fetch', serve(last, [line('ANT', 300), line('RUS', 280), line('HAM', 275), line('LEC', 274)]))
    render(<Standings next={next} now={raceEnd(last) + 1} />)
    await screen.findByText('ANT')
    expect(within(row('ANT')).getByText('Contender')).toBeTruthy()
    expect(within(row('HAM')).getByText('Contender')).toBeTruthy()
    expect(within(row('LEC')).queryByText('Contender')).toBeNull()
    expect(row('LEC').className).toBe('out')
    expect(within(row('RUS')).getByText('−20')).toBeTruthy()
    expect(screen.getByText(/can still win the title/).textContent).toContain('3 drivers')
  })

  it('names the champion once the title is decided', async () => {
    vi.stubGlobal('fetch', serve(races.length, [line('ANT', 300), line('RUS', 299)]))
    render(<Standings next={next} now={raceEnd(races.length) + 1} />)
    expect(await screen.findByText('Champion')).toBeTruthy()
    expect(within(row('RUS')).queryByText('Contender')).toBeNull()
    expect(screen.getByText(/title decided/)).toBeTruthy()
  })

  it('counts a team one-two when marking constructor contenders', async () => {
    // Only the final race is left: 43 points for a team.
    const last = races.length - 1
    vi.stubGlobal('fetch', serve(last, [line('ANT', 300)], [team('Williams', 600), team('Ferrari', 557), team('McLaren', 556)]))
    render(<Standings next={next} now={raceEnd(last) + 1} />)
    await screen.findByText('Williams')
    expect(within(row('Ferrari')).getByText('Contender')).toBeTruthy()
    expect(row('McLaren').className).toBe('out')
    expect(screen.getByText(/teams can still win/).textContent).toContain('2 teams')
  })

  it('offers a retry when the standings fail to load', async () => {
    const fetchMock = vi.fn((url: string): Promise<Response> =>
      url.includes('constructorstandings') ? Promise.resolve(list(1, 'ConstructorStandings', [])) : Promise.reject(new TypeError('Failed to fetch')),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<Standings next={next} now={Date.now()} />)
    expect((await screen.findByRole('alert')).textContent).toContain('unreachable')
    fetchMock.mockImplementation(serve(1, [line('ANT', 25)]))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('ANT')).toBeTruthy()
  })
})
