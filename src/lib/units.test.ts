import { describe, expect, it } from 'vitest'
import { compass } from './format'
import { makeUnits, pct } from './units'

describe('units', () => {
  const metric = makeUnits('metric')
  const imperial = makeUnits('imperial')

  it('formats metric values as given', () => {
    expect(metric.temp(21.6)).toBe('22°')
    expect(metric.speed(12.4)).toBe('12')
    expect(metric.precip(1.25)).toBe('1.3')
    expect(metric.pressure(1013.4)).toBe('1013')
    expect(metric.distance(24000)).toBe('24 km')
  })

  it('converts to imperial', () => {
    expect(imperial.temp(0)).toBe('32°')
    expect(imperial.temp(100)).toBe('212°')
    expect(imperial.speed(100)).toBe('62')
    expect(imperial.precip(25.4)).toBe('1.00')
    expect(imperial.pressure(1013.25)).toBe('29.92')
    expect(imperial.distance(1609.344)).toBe('1.0 mi')
  })

  it('shows a dash for missing values', () => {
    expect(metric.temp(null)).toBe('–')
    expect(imperial.speed(undefined)).toBe('–')
    expect(pct(null)).toBe('–')
  })
})

describe('compass', () => {
  it('names the sixteen points', () => {
    expect(compass(0)).toBe('N')
    expect(compass(359)).toBe('N')
    expect(compass(173)).toBe('S')
    expect(compass(315)).toBe('NW')
    expect(compass(null)).toBe('–')
  })
})
