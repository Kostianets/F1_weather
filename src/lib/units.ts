import { createContext, useContext } from 'react'

export type UnitSystem = 'metric' | 'imperial'
type V = number | null | undefined

const DASH = '–'

export interface Units {
  system: UnitSystem
  tempUnit: string
  speedUnit: string
  precipUnit: string
  pressureUnit: string
  /** Convert from the metric values the APIs return, for charts and scales. */
  toTemp: (c: number) => number
  toSpeed: (kmh: number) => number
  toPrecip: (mm: number) => number
  toPressure: (hpa: number) => number
  temp: (c: V) => string
  speed: (kmh: V) => string
  precip: (mm: V) => string
  pressure: (hpa: V) => string
  distance: (m: V) => string
}

export function makeUnits(system: UnitSystem): Units {
  const metric = system === 'metric'
  const toTemp = (c: number) => (metric ? c : (c * 9) / 5 + 32)
  const toSpeed = (kmh: number) => (metric ? kmh : kmh / 1.609344)
  const toPrecip = (mm: number) => (metric ? mm : mm / 25.4)
  const toPressure = (hpa: number) => (metric ? hpa : hpa * 0.02953)
  return {
    system,
    tempUnit: metric ? '°C' : '°F',
    speedUnit: metric ? 'km/h' : 'mph',
    precipUnit: metric ? 'mm' : 'in',
    pressureUnit: metric ? 'hPa' : 'inHg',
    toTemp,
    toSpeed,
    toPrecip,
    toPressure,
    temp: (c) => (c == null ? DASH : `${Math.round(toTemp(c))}°`),
    speed: (kmh) => (kmh == null ? DASH : String(Math.round(toSpeed(kmh)))),
    precip: (mm) => (mm == null ? DASH : toPrecip(mm).toFixed(metric ? 1 : 2)),
    pressure: (hpa) => (hpa == null ? DASH : metric ? String(Math.round(hpa)) : toPressure(hpa).toFixed(2)),
    distance: (m) => {
      if (m == null) return DASH
      const v = metric ? m / 1000 : m / 1609.344
      return `${v >= 10 ? Math.round(v) : v.toFixed(1)} ${metric ? 'km' : 'mi'}`
    },
  }
}

export const UnitsContext = createContext<Units>(makeUnits('metric'))
export const useUnits = () => useContext(UnitsContext)

export const pct = (v: V) => (v == null ? DASH : `${Math.round(v)}%`)
