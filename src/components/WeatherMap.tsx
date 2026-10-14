import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { memo, useEffect, useRef, useState } from 'react'
import { GRID_COLS, GRID_ROWS, getGrid, getRadarFrames } from '../api/mapData'
import type { Grid, GridField, RadarFrame } from '../api/mapData'
import { FORECAST_DAYS } from '../api/weather'
import { fmtDayTime } from '../lib/format'
import { circuitOutline } from '../lib/track'
import { useUnits } from '../lib/units'
import type { Units } from '../lib/units'
import type { Session } from '../types'

const HOUR = 3_600_000

type LayerId = 'radar' | 'satellite' | 'clouds' | 'rain' | 'temp' | 'wind' | 'pressure'
type Window = 'next' | 'weekend'
type Stop = [value: number, r: number, g: number, b: number, a: number]

interface LayerDef {
  id: LayerId
  label: string
  hint: string
  field?: Exclude<GridField, 'windDir'>
  stops?: Stop[]
}

const LAYERS: LayerDef[] = [
  { id: 'radar', label: 'Rain radar', hint: 'Observed precipitation, last 2 hours (RainViewer)' },
  { id: 'satellite', label: 'Satellite', hint: 'Latest infrared cloud image (EUMETSAT)' },
  {
    id: 'clouds',
    label: 'Clouds',
    hint: 'Forecast cloud cover',
    field: 'cloud',
    stops: [
      [0, 255, 255, 255, 0],
      [20, 255, 255, 255, 0.08],
      [60, 235, 240, 250, 0.5],
      [100, 245, 247, 252, 0.88],
    ],
  },
  {
    id: 'rain',
    label: 'Rain',
    hint: 'Forecast precipitation per hour',
    field: 'precip',
    stops: [
      [0, 76, 201, 240, 0],
      [0.1, 76, 201, 240, 0.35],
      [1, 58, 134, 255, 0.65],
      [4, 60, 200, 110, 0.75],
      [10, 255, 209, 60, 0.82],
      [20, 255, 110, 40, 0.88],
      [40, 225, 6, 0, 0.92],
    ],
  },
  {
    id: 'temp',
    label: 'Temperature',
    hint: 'Forecast air temperature',
    field: 'temp',
    stops: [
      [-10, 80, 60, 200, 0.6],
      [0, 60, 150, 255, 0.6],
      [10, 60, 200, 190, 0.6],
      [20, 110, 210, 90, 0.6],
      [27, 255, 215, 70, 0.6],
      [34, 255, 130, 40, 0.62],
      [42, 225, 6, 0, 0.65],
    ],
  },
  {
    id: 'wind',
    label: 'Wind',
    hint: 'Forecast wind speed and direction',
    field: 'wind',
    stops: [
      [0, 40, 70, 110, 0.2],
      [10, 60, 170, 200, 0.5],
      [25, 110, 210, 110, 0.6],
      [40, 255, 215, 70, 0.65],
      [60, 255, 120, 40, 0.7],
      [90, 225, 6, 0, 0.75],
    ],
  },
  {
    id: 'pressure',
    label: 'Pressure',
    hint: 'Forecast sea-level pressure',
    field: 'pressure',
    stops: [
      [985, 150, 70, 220, 0.6],
      [1000, 70, 130, 240, 0.55],
      [1013, 90, 190, 170, 0.45],
      [1025, 250, 200, 80, 0.55],
      [1040, 240, 100, 50, 0.6],
    ],
  },
]

function colorAt(stops: Stop[], v: number): [number, number, number, number] {
  if (v <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3], stops[0][4]]
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]
    const b = stops[i]
    if (v <= b[0]) {
      const k = (v - a[0]) / (b[0] - a[0])
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k]
    }
  }
  const last = stops[stops.length - 1]
  return [last[1], last[2], last[3], last[4]]
}

/** Paints one value per grid point, then lets the canvas smooth it up into a field image. */
function fieldImage(values: (number | null)[], stops: Stop[]): string {
  const small = document.createElement('canvas')
  small.width = GRID_COLS
  small.height = GRID_ROWS
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(GRID_COLS, GRID_ROWS)
  values.forEach((v, i) => {
    const [r, g, b, a] = v == null ? [0, 0, 0, 0] : colorAt(stops, v)
    img.data.set([r, g, b, a * 255], i * 4)
  })
  sctx.putImageData(img, 0, 0)
  const big = document.createElement('canvas')
  big.width = GRID_COLS * 40
  big.height = GRID_ROWS * 40
  const bctx = big.getContext('2d')!
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.drawImage(small, 0, 0, big.width, big.height)
  return big.toDataURL()
}

function legendFor(def: LayerDef, units: Units): { gradient: string; ticks: string[]; unit: string } | null {
  if (!def.stops) return null
  const lo = def.stops[0][0]
  const hi = def.stops[def.stops.length - 1][0]
  const gradient = def.stops
    .map(([v, r, g, b, a]) => `rgba(${r},${g},${b},${Math.max(a, 0.15)}) ${(((v - lo) / (hi - lo)) * 100).toFixed(0)}%`)
    .join(', ')
  const pick = [lo, (lo + hi) / 2, hi]
  switch (def.id) {
    case 'temp':
      return { gradient, ticks: pick.map((v) => units.temp(v)), unit: units.tempUnit }
    case 'wind':
      return { gradient, ticks: pick.map((v) => units.speed(v)), unit: units.speedUnit }
    case 'rain':
      return { gradient, ticks: pick.map((v) => units.precip(v)), unit: `${units.precipUnit}/h` }
    case 'pressure':
      return { gradient, ticks: pick.map((v) => units.pressure(v)), unit: units.pressureUnit }
    default:
      return { gradient, ticks: pick.map((v) => String(Math.round(v))), unit: '%' }
  }
}

interface Props {
  lat: number
  lon: number
  circuitId: string
  tz: string | undefined
  sessions: Session[]
}

export default memo(function WeatherMap({ lat, lon, circuitId, tz, sessions }: Props) {
  const units = useUnits()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const radarLayers = useRef(new Map<string, L.TileLayer>())
  const satellite = useRef<L.TileLayer | null>(null)
  const field = useRef<L.ImageOverlay | null>(null)
  const marks = useRef<L.LayerGroup | null>(null)

  const [layer, setLayer] = useState<LayerId>('radar')
  const [frames, setFrames] = useState<RadarFrame[]>([])
  const [frameIdx, setFrameIdx] = useState(0)
  const [win, setWin] = useState<Window>('next')
  const [grid, setGrid] = useState<Grid | null>(null)
  const [hourIdx, setHourIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const def = LAYERS.find((l) => l.id === layer)!
  const [opened] = useState(Date.now)
  const weekendEnd = sessions[sessions.length - 1].end + 2 * HOUR
  const weekendReady = weekendEnd < opened + (FORECAST_DAYS - 1) * 24 * HOUR && weekendEnd > opened

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { center: [lat, lon], zoom: 8, minZoom: 4, maxZoom: 15, zoomSnap: 0.5 })
    // Stadia needs no key on localhost; a hosted copy is authorised by registering its domain with Stadia.
    L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    }).addTo(m)

    m.createPane('track').style.zIndex = '460'
    const outline = circuitOutline(circuitId)
    if (outline) {
      L.polyline(outline.map(([x, y]) => [y, x] as L.LatLngTuple), { color: '#ff2b1c', weight: 3, pane: 'track' }).addTo(m)
    }
    L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#e10600', fillOpacity: 1, pane: 'track' }).addTo(m)

    satellite.current = L.tileLayer.wms('https://view.eumetsat.int/geoserver/wms', {
      layers: 'mumi:worldcloudmap_ir108',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.85,
      className: 'satellite-tiles',
      attribution: '&copy; <a href="https://www.eumetsat.int">EUMETSAT</a>',
    })
    marks.current = L.layerGroup()
    map.current = m
    const layers = radarLayers.current
    return () => {
      m.remove()
      map.current = null
      field.current = null
      layers.clear()
    }
  }, [lat, lon, circuitId])

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getRadarFrames()
        .then((f) => {
          if (cancelled) return
          setFrames(f)
          setFrameIdx(f.length - 1)
        })
        .catch((e: Error) => !cancelled && setError(e.message))
    load()
    const id = setInterval(load, 5 * 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const needsGrid = def.field != null
  useEffect(() => {
    if (!needsGrid) return
    let cancelled = false
    const now = Date.now()
    const from = win === 'weekend' ? Math.max(now, sessions[0].start - 2 * HOUR) : now
    const to = win === 'weekend' ? sessions[sessions.length - 1].end + 2 * HOUR : now + 48 * HOUR
    getGrid(lat, lon, from, to)
      .then((g) => {
        if (cancelled) return
        setError(null)
        setGrid(g)
        setHourIdx(0)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [needsGrid, win, lat, lon, sessions])

  // Keep the Leaflet layers in step with the selected layer and time.
  useEffect(() => {
    const m = map.current
    if (!m) return

    const radar = radarLayers.current
    const wanted = new Set(layer === 'radar' ? frames.map((f) => f.url) : [])
    for (const [url, tiles] of radar) {
      if (!wanted.has(url)) {
        tiles.remove()
        radar.delete(url)
      }
    }
    if (layer === 'radar') {
      frames.forEach((f, i) => {
        let tiles = radar.get(f.url)
        if (!tiles) {
          // RainViewer serves radar up to zoom 7; deeper zooms stretch those tiles.
          tiles = L.tileLayer(f.url, { maxNativeZoom: 7, opacity: 0, attribution: '<a href="https://www.rainviewer.com">RainViewer</a>' })
          tiles.addTo(m)
          radar.set(f.url, tiles)
        }
        tiles.setOpacity(i === frameIdx ? 0.8 : 0)
      })
    }

    if (layer === 'satellite') satellite.current!.addTo(m)
    else satellite.current!.remove()

    const group = marks.current!
    group.clearLayers()
    if (def.field && def.stops && grid) {
      const values = grid.fields[def.field][hourIdx]
      const bounds: L.LatLngBoundsExpression = [
        [grid.lats[GRID_ROWS - 1] - grid.latStep / 2, grid.lons[0] - grid.lonStep / 2],
        [grid.lats[0] + grid.latStep / 2, grid.lons[GRID_COLS - 1] + grid.lonStep / 2],
      ]
      const url = fieldImage(values, def.stops)
      if (field.current) field.current.setUrl(url).setBounds(L.latLngBounds(bounds))
      else field.current = L.imageOverlay(url, bounds, { className: 'field-image' })
      field.current.addTo(m)

      const dirs = grid.fields.windDir[hourIdx]
      values.forEach((v, i) => {
        if (v == null) return
        const at: L.LatLngTuple = [grid.lats[Math.floor(i / GRID_COLS)], grid.lons[i % GRID_COLS]]
        let html: string | null = null
        if (layer === 'wind') {
          html = `<svg viewBox="0 0 16 16" style="transform:rotate(${(dirs[i] ?? 0) + 180}deg)"><path d="M8 1l4.5 7.5H9.2V15H6.8V8.5H3.5z"/></svg><span>${units.speed(v)}</span>`
        } else if (layer === 'temp') {
          html = `<span>${units.temp(v)}</span>`
        } else if (layer === 'pressure') {
          html = `<span>${units.pressure(v)}</span>`
        }
        if (html) {
          L.marker(at, { interactive: false, icon: L.divIcon({ className: 'grid-mark', html, iconSize: [44, 20] }) }).addTo(group)
        }
      })
      group.addTo(m)
    } else {
      field.current?.remove()
      group.remove()
    }
  }, [layer, def, frames, frameIdx, grid, hourIdx, units, lat, lon, circuitId])

  const steps = layer === 'radar' ? frames.length : needsGrid ? (grid?.times.length ?? 0) : 0
  const index = layer === 'radar' ? frameIdx : hourIdx
  const setIndex = layer === 'radar' ? setFrameIdx : setHourIdx
  const time = layer === 'radar' ? frames[frameIdx]?.t : needsGrid ? grid?.times[hourIdx] : undefined

  useEffect(() => {
    if (!playing || steps < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % steps), layer === 'radar' ? 500 : 350)
    return () => clearInterval(id)
  }, [playing, steps, layer, setIndex])

  const legend = legendFor(def, units)

  return (
    <section>
      <div className="panel-head">
        <h2>Weather map</h2>
        <div className="tabs" role="group" aria-label="Map layer">
          {LAYERS.map((l) => (
            <button key={l.id} className={l.id === layer ? 'on' : ''} aria-pressed={l.id === layer} title={l.hint} onClick={() => setLayer(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="panel map-panel">
        <div className="map" ref={el} role="region" aria-label={`Map around the circuit showing ${def.label.toLowerCase()}`} />
        {legend && (
          <div className="map-legend">
            <div className="map-legend-bar" style={{ background: `linear-gradient(to right, ${legend.gradient})` }} />
            <div className="map-legend-ticks">
              {legend.ticks.map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
            <div className="label">
              {def.hint} · {legend.unit}
            </div>
          </div>
        )}
        <div className="map-controls">
          {steps > 1 ? (
            <>
              <button className="play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <input
                type="range"
                min={0}
                max={steps - 1}
                value={index}
                aria-label="Map time"
                aria-valuetext={time ? fmtDayTime(time, tz) : undefined}
                onChange={(e) => {
                  setPlaying(false)
                  setIndex(Number(e.target.value))
                }}
              />
              <div className="map-time">
                <b>{time ? fmtDayTime(time, tz) : '–'}</b>
                <span>{layer === 'radar' ? 'observed · track time' : 'forecast · track time'}</span>
              </div>
            </>
          ) : (
            <div className="map-time wide">
              <b>{error ? `Could not load this layer: ${error}` : layer === 'satellite' ? 'Latest satellite image' : 'Loading…'}</b>
              <span>{def.hint}</span>
            </div>
          )}
          {needsGrid && (
            <div className="tabs" role="group" aria-label="Map forecast period">
              <button className={win === 'next' ? 'on' : ''} aria-pressed={win === 'next'} onClick={() => setWin('next')}>
                Next 48 h
              </button>
              <button
                className={win === 'weekend' ? 'on' : ''} aria-pressed={win === 'weekend'}
                disabled={!weekendReady}
                title={weekendReady ? undefined : 'The race weekend is outside the forecast range'}
                onClick={() => setWin('weekend')}
              >
                Race weekend
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
})
