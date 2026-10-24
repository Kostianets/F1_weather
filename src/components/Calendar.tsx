import { fmt, fmtDayTime } from '../lib/format'
import type { NextRace } from '../types'

interface Props {
  next: NextRace
  now: number
}

// Only the track's own zone is known for the race the weather was loaded for,
// so the whole calendar uses the viewer's zone.
function weekendDates(start: number, end: number): string {
  const sameMonth = fmt(start, undefined, { month: 'short' }) === fmt(end, undefined, { month: 'short' })
  const from = fmt(start, undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${from} – ${fmt(end, undefined, { day: 'numeric', month: 'short' })}`
}

export default function Calendar({ next, now }: Props) {
  const { races, race: current } = next
  return (
    <section>
      <div className="panel-head">
        <h2>{current.season} calendar</h2>
        <span className="note">
          {races.length} rounds · times in your zone
        </span>
      </div>
      <ol className="calendar panel">
        {races.map((r) => {
          const first = r.sessions[0]
          const last = r.sessions.at(-1)
          const race = r.sessions.find((s) => s.key === 'race')
          const live = r.sessions.some((s) => s.start <= now && now < s.end)
          const done = last != null && last.end <= now
          const isNext = !next.finished && r.round === current.round
          return (
            <li key={r.round} className={`calendar-row${done ? ' done' : ''}${isNext ? ' next' : ''}`}>
              <span className="calendar-round">R{r.round}</span>
              <div className="calendar-race">
                <b>{r.name}</b>
                <span>
                  {r.locality}, {r.country}
                </span>
              </div>
              <div className="calendar-when">
                <b>{first && last ? weekendDates(first.start, last.start) : 'Dates TBC'}</b>
                {race && <span>Race {fmtDayTime(race.start)}</span>}
              </div>
              <div className="calendar-chips">
                {r.sessions.some((s) => s.key === 'sprint') && <span className="chip">Sprint</span>}
                {live ? (
                  <span className="chip state-live">Live</span>
                ) : isNext ? (
                  <span className="chip state-next">Next</span>
                ) : (
                  done && <span className="chip">Finished</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
