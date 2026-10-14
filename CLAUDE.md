# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b (type check) then vite build -> dist/
npm run lint         # oxlint (config in .oxlintrc.json)
npm test             # vitest run (all tests once)
npm run test:watch   # vitest watch mode
npx vitest run src/lib/track.test.ts        # single test file
npx vitest run -t "part of a test name"     # single test by name
```

CI (`.github/workflows/deploy.yml`) runs lint → test → build on every push to `main` and deploys `dist/` to GitHub Pages. `vite.config.ts` uses `base: './'` so the build works from a Pages project subfolder; keep asset paths relative.

## Architecture

Single-page React 19 + TypeScript dashboard showing weather for the next F1 race weekend. No backend and no API keys: everything is fetched client-side from free public APIs (see the README table).

**Data flow.** `src/App.tsx` owns all state: unit system (persisted in `localStorage` key `track-weather-units`), the next race, weather, air quality, error, and a `now` that ticks every 60 s. Weather and air quality reload every 10 min. Per-session forecasts (`sessionForecast`) are memoized in App and passed down. Components don't fetch, except `WeatherMap`, which loads its own radar and grid data.

**API layer (`src/api/`).**
- `http.ts` `getJson(url, service, timeout, retryDelays)` is the single fetch wrapper. It uses `AbortSignal.timeout` and retries only on HTTP 429/502/503/504; network errors and timeouts are not retried. Its error messages are shown to users verbatim in App's banner. `expect(cond, service)` validates response shape. Every API response should pass through `expect` checks. The `retryDelays` parameter exists so tests can skip the waits.
- `schedule.ts` `getNextRace(now)` fetches the Jolpica calendar. If the current season is over it tries next year, and if nothing is upcoming it returns the last race with `finished: true`. **Any** failure falls back to `src/data/season-fallback.json` (`source: 'bundled'`). It never rejects, and App relies on that (no `.catch`). Session lengths are fixed assumptions in `toRace`. A race stays "next" until its last session ends.
- `weather.ts`: Open-Meteo forecast (`past_days=1`, `forecast_days=16`, `timeformat=unixtime`, so 17×24 hourly points) plus air quality.
- `mapData.ts`: Open-Meteo multi-point grid (11×7 points around the circuit) for map forecast layers, and RainViewer radar frames.

**Domain logic (`src/lib/`).**
- `track.ts` holds the model. `applyTrackModel` carries standing water forward hour by hour to estimate track state (dry/damp/wet) and asphalt temperature; these are estimates, not measurements. `hourAt` assumes contiguous hourly arrays. `circuitOutline(circuitId)` looks up `src/data/circuits.json`, keyed by Jolpica `circuitId` with **[lon, lat]** GeoJSON order (Leaflet needs [lat, lon]). It returns null for unknown circuits.
- `units.ts`: data stays metric everywhere. `makeUnits(system)` builds converters and formatters, provided through `UnitsContext` / `useUnits()`. Format null values as `'–'`.
- `format.ts`: times are epoch ms; formatting takes an IANA tz (the track's), and `undefined` means the viewer's zone.

**UI.**
- Every panel in App is wrapped in its own `PanelBoundary` (an error boundary with a retry button), so one crashing panel doesn't take down the page. It catches render errors only.
- Charts are hand-rolled SVG (`Chart.tsx` is generic; `Charts.tsx` shares one hover index across all charts). There is no chart library.
- `WeatherMap.tsx` is Leaflet, lazy-loaded inside Suspense. It uses an Esri Dark Gray basemap, RainViewer radar, a EUMETSAT WMS satellite layer, and grid fields drawn as an `ImageOverlay`.
- Styling lives in one global `src/index.css` with CSS custom properties on `:root`. The theme is dark only, and class names are kebab-case.

## Testing conventions

- The default Vitest environment is `node`. Files that need the DOM declare `// @vitest-environment jsdom` at the top. `restoreMocks: true` is set globally.
- Mock `fetch` with `vi.stubGlobal('fetch', ...)`, routing by URL substring, and call `vi.unstubAllGlobals()` in `afterEach`. Helpers live in `src/test/fixtures.ts` (`hours()`, `openMeteoResponse()`, `jsonResponse()`).
- To pin time, fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'], now })`) so that real timers and `findBy*` keep working.
- `App.test.tsx` mocks `./components/WeatherMap` (Leaflet needs real layout) and stubs `ResizeObserver`.
- Schedule and App tests use `season-fallback.json` as live data, and their assertions are hard-coded to it (23 rounds, specific next and last races). Updating the bundled calendar means updating those tests.

## Maintenance notes

- `season-fallback.json` covers only the 2026 season. It and `circuits.json` need manual updates for new seasons or circuits.
- Open-Meteo and Esri are free for non-commercial use only.
