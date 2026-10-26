// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import fallbackSeason from './data/season-fallback.json'
import { jsonResponse, openMeteoResponse } from './test/fixtures'

// Leaflet needs a real browser layout engine; the map is checked in the browser instead.
vi.mock('./components/WeatherMap', () => ({ default: () => <section>map</section> }))

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

function stubServices({ calendar }: { calendar: () => Promise<Response> }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('jolpi.ca')) return calendar()
      if (url.includes('air-quality')) return Promise.resolve(jsonResponse({ current: { us_aqi: 30, pm2_5: 6, pm10: 10, ozone: 50 } }))
      return Promise.resolve(jsonResponse(openMeteoResponse(Date.now())))
    }),
  )
}

const calendarDown = () => Promise.reject(new TypeError('Failed to fetch'))
const calendarNonsense = () => Promise.resolve(jsonResponse({}, 200))
const calendarUp = () => Promise.resolve(jsonResponse({ MRData: { RaceTable: { Races: fallbackSeason } } }))

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  history.replaceState(null, '', location.pathname)
  vi.useRealTimers()
})

describe('App', () => {
  it('shows the bundled calendar with a warning when the live one is down', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendar: calendarDown })
    render(<App />)
    expect(await screen.findByText(/Live calendar is unreachable/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('United States Grand Prix')
  })

  it('falls back too when the calendar answers with nonsense', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendar: calendarNonsense })
    render(<App />)
    expect(await screen.findByText(/Live calendar is unreachable/)).toBeTruthy()
  })

  it('lays out a sprint weekend with forecasts for every session', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-03-11T12:00:00Z') })
    stubServices({ calendar: calendarDown })
    render(<App />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Chinese Grand Prix')
    const cards = await screen.findAllByRole('article')
    expect(cards.map((c) => c.querySelector('.session-short')!.textContent)).toEqual(['FP1', 'SQ', 'SPR', 'Q', 'RACE'])
    for (const card of cards) expect(await within(card).findByText('Track est.')).toBeTruthy()
  })

  it('switches to the season calendar and back', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendar: calendarDown })
    render(<App />)
    await screen.findByRole('heading', { level: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
    expect(location.hash).toBe('#calendar')
    expect(screen.getAllByRole('listitem')).toHaveLength(23)
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }))
    expect(location.hash).toBe('')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('United States Grand Prix')
  })

  it('opens straight on the calendar from a #calendar link', async () => {
    history.replaceState(null, '', '#calendar')
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendar: calendarDown })
    render(<App />)
    expect(await screen.findByRole('heading', { name: '2026 calendar' })).toBeTruthy()
  })

  it('opens the drivers\' standings from a #standings link', async () => {
    history.replaceState(null, '', '#standings')
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendar: calendarDown })
    render(<App />)
    expect(await screen.findByRole('heading', { name: "2026 drivers' championship" })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Standings' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('re-reads the calendar so it recovers without a reload', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: Date.parse('2026-10-14T12:00:00Z') })
    let calendar: () => Promise<Response> = calendarDown
    stubServices({ calendar: () => calendar() })
    render(<App />)
    expect(await screen.findByText(/Live calendar is unreachable/)).toBeTruthy()
    calendar = calendarUp
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await waitFor(() => expect(screen.queryByText(/Live calendar is unreachable/)).toBeNull())
  })
})
