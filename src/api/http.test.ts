import { afterEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, openMeteoResponse } from '../test/fixtures'
import { getJson } from './http'
import { getWeather } from './weather'

afterEach(() => vi.unstubAllGlobals())

describe('getJson', () => {
  it('reports a timeout in plain words', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason)))),
    )
    await expect(getJson('https://example.test', 'The test service', 20)).rejects.toThrow('The test service did not respond in time')
  })

  it('reports an unreachable service', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getJson('https://example.test', 'The test service')).rejects.toThrow('The test service is unreachable')
  })

  it('reports an HTTP error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 503)))
    await expect(getJson('https://example.test', 'The test service')).rejects.toThrow('error 503')
  })
})

describe('getWeather', () => {
  it('parses an Open-Meteo response and runs the track model', async () => {
    const now = Date.parse('2026-10-14T12:00:00Z')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(openMeteoResponse(now))))
    const w = await getWeather(30, -97)
    expect(w.hours).toHaveLength(17 * 24)
    expect(w.hours[0].t).toBe(Date.parse('2026-10-13T00:00:00Z'))
    expect(w.hours[0].trackTemp).toBeGreaterThan(21)
    expect(w.days[0].sunrise).toBe(Date.parse('2026-10-13T06:00:00Z'))
    expect(w.current.temp).toBe(21)
  })

  it('rejects a response missing the forecast tables', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ current: {} })))
    await expect(getWeather(30, -97)).rejects.toThrow('unexpected format')
  })
})
