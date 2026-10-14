// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { jsonResponse, openMeteoResponse } from './test/fixtures'

// Leaflet needs a real browser layout engine; the map is checked in the browser instead.
vi.mock('./components/WeatherMap', () => ({ default: () => <section>map</section> }))

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

function stubServices({ calendarUp }: { calendarUp: boolean }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('jolpi.ca')) {
        return calendarUp ? Promise.resolve(jsonResponse({}, 200)) : Promise.reject(new TypeError('Failed to fetch'))
      }
      if (url.includes('air-quality')) return Promise.resolve(jsonResponse({ current: { us_aqi: 30, pm2_5: 6, pm10: 10, ozone: 50 } }))
      return Promise.resolve(jsonResponse(openMeteoResponse(Date.now())))
    }),
  )
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('App', () => {
  it('shows the bundled calendar with a warning when the live one is down', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendarUp: false })
    render(<App />)
    expect(await screen.findByText(/Live calendar is unreachable/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('United States Grand Prix')
  })

  it('falls back too when the calendar answers with nonsense', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-10-14T12:00:00Z') })
    stubServices({ calendarUp: true })
    render(<App />)
    expect(await screen.findByText(/Live calendar is unreachable/)).toBeTruthy()
  })

  it('lays out a sprint weekend with forecasts for every session', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-03-11T12:00:00Z') })
    stubServices({ calendarUp: false })
    render(<App />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Chinese Grand Prix')
    const cards = await screen.findAllByRole('article')
    expect(cards.map((c) => c.querySelector('.session-short')!.textContent)).toEqual(['FP1', 'SQ', 'SPR', 'Q', 'RACE'])
    for (const card of cards) expect(await within(card).findByText('Track est.')).toBeTruthy()
  })
})
