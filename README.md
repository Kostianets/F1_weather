# Track Weather

Weather dashboard for the next Formula 1 race weekend: current conditions at the circuit, a forecast for every session, an animated weather map, hourly charts and a day-by-day outlook.

## Link
https://kostianets.github.io/F1_weather/

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` produces static files in `dist/` that can be hosted anywhere.

```bash
npm test        # run the test suite once
npm run lint    # static checks
```

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` lints, tests, builds and publishes the site on every push to `main`.

1. Push the project to a GitHub repository with `main` as the default branch.
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow by hand from the **Actions** tab). The site appears at `https://<user>.github.io/<repo>/`.

## Where the data comes from

No API keys are needed.

| What | Source |
| --- | --- |
| Race calendar and session times | [Jolpica F1](https://github.com/jolpica/jolpica-f1), with `src/data/season-fallback.json` used when it is unreachable |
| Forecasts, current conditions, air quality, map forecast layers | [Open-Meteo](https://open-meteo.com) |
| Rain radar (observed, last 2 hours) | [RainViewer](https://www.rainviewer.com) |
| Satellite cloud image | [EUMETSAT](https://www.eumetsat.int) |
| Circuit outlines | [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT), in `src/data/circuits.json` |
| Basemap | [Esri](https://www.esri.com) World Dark Gray Canvas |

## Things worth knowing

- **Track temperature and track state are estimates.** They are derived from air temperature, solar radiation, wind and rainfall in `src/lib/track.ts`; nothing measures the asphalt.
- Forecasts reach 16 days ahead. Sessions further out show when their forecast will appear.
- The map's forecast layers (clouds, rain, temperature, wind, pressure) are drawn from a grid of forecast points around the circuit, so they only cover the region near the track.
- Session lengths are assumed (the calendar only gives start times): 60 min for practice, qualifying and sprint, 45 min for sprint qualifying, 120 min for the race.
- Every request gives up after a timeout and checks the response format. A panel that crashes shows a message with a retry button instead of taking the page down.
- Open-Meteo and the Esri basemap are free for non-commercial use. Adding ads or payments means moving to their paid plans.
- The bundled calendar and circuit outlines need refreshing by hand when a new season or circuit is added.

Unofficial project, not associated with Formula 1.
