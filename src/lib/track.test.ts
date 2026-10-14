import { describe, expect, it } from 'vitest'
import { hours } from '../test/fixtures'
import type { Session } from '../types'
import { applyTrackModel, estimateTrackTemp, hourAt, longestStraight, sessionForecast, windOnStraight } from './track'

const T0 = Date.parse('2026-10-23T00:00:00Z')
const HOUR = 3_600_000

describe('estimateTrackTemp', () => {
  it('heats a sunny, calm track well above the air', () => {
    const t = estimateTrackTemp(30, 900, 900, 5, false)
    expect(t).toBeGreaterThan(50)
    expect(t).toBeLessThan(62)
  })

  it('keeps the track close to air temperature at night', () => {
    expect(estimateTrackTemp(18, 0, 0, 10, false)).toBeCloseTo(19.5)
  })

  it('cools the track with wind and with water', () => {
    const calm = estimateTrackTemp(25, 800, 800, 0, false)
    expect(estimateTrackTemp(25, 800, 800, 40, false)).toBeLessThan(calm)
    expect(estimateTrackTemp(25, 800, 800, 0, true)).toBeLessThan(calm)
  })
})

describe('applyTrackModel', () => {
  it('goes wet in rain and dries out again afterwards', () => {
    const list = hours(T0, 12, (i) => ({ precip: i === 2 ? 3 : 0, rad: 300, wind: 10 }))
    applyTrackModel(list)
    const states = list.map((h) => h.trackState)
    expect(states.slice(0, 2)).toEqual(['dry', 'dry'])
    expect(states[2]).toBe('wet')
    expect(states.at(-1)).toBe('dry')
  })

  it('caps standing water, so a downpour does not keep the track wet for a day', () => {
    const list = hours(T0, 24, (i) => ({ precip: i < 3 ? 30 : 0, rad: 100, wind: 5 }))
    applyTrackModel(list)
    const firstDry = list.findIndex((h, i) => i > 2 && h.trackState === 'dry')
    expect(firstDry).toBeGreaterThan(2)
    expect(firstDry).toBeLessThan(8)
  })

  it('leaves track temperature empty where the forecast has no air temperature', () => {
    const list = hours(T0, 3, (i) => ({ temp: i === 1 ? null : 20 }))
    applyTrackModel(list)
    expect(list[1].trackTemp).toBeNull()
    expect(list[2].trackTemp).not.toBeNull()
  })
})

describe('sessionForecast', () => {
  const session: Session = { key: 'race', name: 'Race', short: 'RACE', start: T0 + 13.5 * HOUR, end: T0 + 15.5 * HOUR }

  it('summarises the hours the session overlaps', () => {
    const list = hours(T0, 24, (i) => ({ temp: i, pop: i === 14 ? 70 : 10, precip: i === 15 ? 1.2 : 0 }))
    applyTrackModel(list)
    const f = sessionForecast(list, session)!
    // Hours starting 13:00, 14:00 and 15:00 overlap 13:30–15:30.
    expect(f.temp).toBe(14)
    expect(f.pop).toBe(70)
    expect(f.precip).toBeCloseTo(1.2)
    expect(f.trackState).toBe('wet')
  })

  it('averages wind direction across north instead of pointing south', () => {
    const list = hours(T0, 24, (i) => ({ windDir: i % 2 ? 350 : 10 }))
    const dir = sessionForecast(list, session)!.windDir!
    expect(Math.min(dir, 360 - dir)).toBeLessThan(5)
  })

  it('returns null outside the forecast range', () => {
    const list = hours(T0, 10)
    expect(sessionForecast(list, session)).toBeNull()
  })

  it('returns null where the model has stopped giving values', () => {
    const list = hours(T0, 24, (i) => ({ temp: i > 12 ? null : 20 }))
    expect(sessionForecast(list, session)).toBeNull()
  })
})

describe('hourAt', () => {
  it('finds the hour containing an instant', () => {
    const list = hours(T0, 5)
    expect(hourAt(list, T0 + 2.5 * HOUR)!.t).toBe(T0 + 2 * HOUR)
    expect(hourAt([], T0)).toBeUndefined()
  })
})

describe('longestStraight', () => {
  it('finds the long side of a rectangle and its heading', () => {
    // 0.02° east–west at the equator is about 2.2 km; the short sides about 0.55 km.
    const outline: [number, number][] = [
      [0, 0],
      [0.01, 0],
      [0.02, 0],
      [0.02, 0.005],
      [0, 0.005],
      [0, 0],
    ]
    const s = longestStraight(outline)!
    expect(s.length).toBeGreaterThan(2000)
    expect([90, 270]).toContain(Math.round(s.bearing))
  })
})

describe('windOnStraight', () => {
  it('splits wind into along and across components', () => {
    const head = windOnStraight(20, 0, 0)
    expect(head.along).toBeCloseTo(20)
    expect(head.across).toBeCloseTo(0)
    const cross = windOnStraight(20, 90, 0)
    expect(cross.along).toBeCloseTo(0)
    expect(cross.across).toBeCloseTo(20)
  })
})
