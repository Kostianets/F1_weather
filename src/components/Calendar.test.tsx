// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { pickNext, toRace } from '../api/schedule'
import type { ApiRace } from '../api/schedule'
import fallbackSeason from '../data/season-fallback.json'
import type { NextRace } from '../types'
import Calendar from './Calendar'

const races = (fallbackSeason as ApiRace[]).map(toRace)

function renderAt(now: number, finished = false) {
  const next: NextRace = { race: pickNext(races, now) ?? races[races.length - 1], races, source: 'live', finished }
  render(<Calendar next={next} now={now} />)
  return screen.getAllByRole('listitem')
}

const row = (items: HTMLElement[], name: string) => items.find((li) => within(li).queryByText(name))!

afterEach(cleanup)

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
})
