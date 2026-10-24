// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickNext, toRace } from '../api/schedule'
import type { ApiRace } from '../api/schedule'
import fallbackSeason from '../data/season-fallback.json'
import { jsonResponse } from '../test/fixtures'
import type { NextRace } from '../types'
import Calendar from './Calendar'

const races = (fallbackSeason as ApiRace[]).map(toRace)

function renderAt(now: number, finished = false) {
  const next: NextRace = { race: pickNext(races, now) ?? races[races.length - 1], races, source: 'live', finished }
  render(<Calendar next={next} now={now} />)
  return screen.getAllByRole('listitem')
}

const row = (items: HTMLElement[], name: string) => items.find((li) => within(li).queryByText(name))!

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const line = (code: string, pos: number) => ({
  position: String(pos),
  positionText: String(pos),
  points: String(26 - pos),
  grid: String(pos + 1),
  laps: '58',
  status: 'Finished',
  Time: { time: pos === 1 ? '1:23:06.801' : `+${pos}.000` },
  Driver: { code, givenName: 'Test', familyName: code },
  Constructor: { name: 'Mercedes' },
})
const table = (key: string, lines: unknown[] | null) =>
  jsonResponse({ MRData: { RaceTable: { Races: lines ? [{ [key]: lines }] : [] } } })

function stubResults(results = () => Promise.resolve(table('Results', [line('RUS', 1), line('ANT', 2)]))) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/results.json')) return results()
    if (url.includes('/sprint.json')) return Promise.resolve(table('SprintResults', null))
    return Promise.resolve(table('QualifyingResults', [{ ...line('RUS', 1), Q1: '1:19.507', Q2: '1:18.934', Q3: '1:18.518' }]))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const toggle = (items: HTMLElement[], name: string) => within(row(items, name)).getAllByRole('button')[0]
const openRound = (items: HTMLElement[], name: string) => fireEvent.click(toggle(items, name))

describe('Calendar', () => {
  it('lists every round and marks finished, next and upcoming races', () => {
    const items = renderAt(Date.parse('2026-10-14T12:00:00Z'))
    expect(items).toHaveLength(23)
    expect(within(row(items, 'Mexico City Grand Prix')).queryByText('Finished')).toBeNull()
    expect(within(row(items, 'Australian Grand Prix')).getByText('Finished')).toBeTruthy()
    const usa = row(items, 'United States Grand Prix')
    expect(within(usa).getByText('Next')).toBeTruthy()
    expect(usa.className).toContain('next')
    expect(items.filter((li) => li.className.includes('next'))).toHaveLength(1)
  })

  it('flags sprint weekends', () => {
    const items = renderAt(Date.parse('2026-10-14T12:00:00Z'))
    expect(within(row(items, 'Chinese Grand Prix')).getByText('Sprint')).toBeTruthy()
    expect(within(row(items, 'Australian Grand Prix')).queryByText('Sprint')).toBeNull()
  })

  it('shows a weekend under way as live', () => {
    const qualiStart = races.find((r) => r.name === 'United States Grand Prix')!.sessions.find((s) => s.key === 'quali')!.start
    const usa = row(renderAt(qualiStart + 10 * 60_000), 'United States Grand Prix')
    expect(within(usa).getByText('Live')).toBeTruthy()
  })

  it('marks no race as next once the season is over', () => {
    const items = renderAt(Date.parse('2027-01-01T00:00:00Z'), true)
    expect(screen.queryByText('Next')).toBeNull()
    expect(items.every((li) => within(li).queryByText('Finished'))).toBe(true)
  })

  it('opens a round to list its sessions in the viewer and track zones', () => {
    const fetchMock = stubResults()
    const items = renderAt(Date.parse('2026-02-01T00:00:00Z'))
    openRound(items, 'Australian Grand Prix')
    expect(toggle(items, 'Australian Grand Prix').getAttribute('aria-expanded')).toBe('true')
    const sessions = within(row(items, 'Australian Grand Prix')).getAllByRole('listitem')
    expect(sessions.map((li) => within(li).getByText(/^(FP\d|Q|RACE)$/).textContent)).toEqual(['FP1', 'FP2', 'FP3', 'Q', 'RACE'])
    expect(sessions[0].textContent).toMatch(/\(track (Fri )?12:30 GMT\+11\)/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps one round open at a time and closes it on a second click', () => {
    stubResults()
    const items = renderAt(Date.parse('2026-02-01T00:00:00Z'))
    openRound(items, 'Australian Grand Prix')
    openRound(items, 'Chinese Grand Prix')
    expect(within(row(items, 'Australian Grand Prix')).queryByText('Practice 1')).toBeNull()
    expect(within(row(items, 'Chinese Grand Prix')).getByText('Sprint Qualifying')).toBeTruthy()
    openRound(items, 'Chinese Grand Prix')
    expect(within(row(items, 'Chinese Grand Prix')).queryByText('Sprint Qualifying')).toBeNull()
  })

  it('shows the race classification of a finished round, with qualifying a tab away', async () => {
    const fetchMock = stubResults()
    const items = renderAt(Date.parse('2026-10-14T12:00:00Z'))
    openRound(items, 'Japanese Grand Prix')
    const round = row(items, 'Japanese Grand Prix')
    expect(await within(round).findByText('1:23:06.801')).toBeTruthy()
    expect(within(round).getByText('+2.000')).toBeTruthy()
    expect(within(round).queryByRole('button', { name: 'Sprint' })).toBeNull()
    fireEvent.click(within(round).getByRole('button', { name: 'Qualifying' }))
    expect(within(round).getByText('1:18.518')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(3)

    openRound(items, 'Japanese Grand Prix')
    openRound(items, 'Japanese Grand Prix')
    expect(within(round).getByText('1:23:06.801')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('offers a retry when results fail to load', async () => {
    let fail = true
    stubResults(() => (fail ? Promise.resolve(jsonResponse({}, 404)) : Promise.resolve(table('Results', [line('RUS', 1)]))))
    const items = renderAt(Date.parse('2026-10-14T12:00:00Z'))
    openRound(items, 'Monaco Grand Prix')
    const round = row(items, 'Monaco Grand Prix')
    expect((await within(round).findByRole('alert')).textContent).toContain('The F1 results service responded with error 404')
    fail = false
    fireEvent.click(within(round).getByRole('button', { name: 'Try again' }))
    expect(await within(round).findByText('1:23:06.801')).toBeTruthy()
  })
})
