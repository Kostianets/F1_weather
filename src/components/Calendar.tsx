import { useState } from 'react'
import { dayKey, fmt, fmtDayTime, fmtTime, fmtWeekday, fmtZone } from '../lib/format'
import type { NextRace, Race, Session } from '../types'
import RoundResults from './RoundResults'

interface Props {
  next: NextRace
  now: number
}

/** Sessions that get a published classification. */
const CLASSIFIED = new Set(['race', 'sprint', 'quali'])

// Weekend dates use the viewer's zone so every row reads the same way.
function weekendDates(start: number, end: number): string {
  const sameMonth = fmt(start, undefined, { month: 'short' }) === fmt(end, undefined, { month: 'short' })
  const from = fmt(start, undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${from} – ${fmt(end, undefined, { day: 'numeric', month: 'short' })}`
}

/** "(track 15:00 GMT-5)", with the weekday only when the track is on a different day. */
function trackTime(ms: number, tz: string): string {
  const day = dayKey(ms, tz) === dayKey(ms) ? '' : `${fmtWeekday(ms, tz)} `
  return `(track ${day}${fmtTime(ms, tz)} ${fmtZone(ms, tz)})`
}

function SessionRow({ s, tz, now }: { s: Session; tz: string | null; now: number }) {
  const live = s.start <= now && now < s.end
  return (
    <li className={`round-session${s.end <= now ? ' done' : ''}`}>
      <span className="round-session-short">{s.short}</span>
      <b>{s.name}</b>
      <span className="round-session-when">
        {fmtDayTime(s.start)}
        {tz && <span> {trackTime(s.start, tz)}</span>}
      </span>
      {live && <span className="chip state-live">Live</span>}
    </li>
  )
}

function RoundDetail({ r, now }: { r: Race; now: number }) {
  const hasResults = r.sessions.some((s) => CLASSIFIED.has(s.key) && s.end <= now)
  return (
    <div className="round-detail" id={`round-${r.round}`}>
      <ul className="round-sessions">
        {r.sessions.map((s) => (
          <SessionRow key={s.key} s={s} tz={r.tz} now={now} />
        ))}
      </ul>
      {hasResults && <RoundResults key={r.round} season={r.season} round={r.round} />}
    </div>
  )
}

export default function Calendar({ next, now }: Props) {
  const { races, race: current } = next
  const [open, setOpen] = useState<number | null>(null)
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
          const isOpen = open === r.round
          return (
            <li key={r.round} className={`calendar-item${done ? ' done' : ''}${isNext ? ' next' : ''}${isOpen ? ' open' : ''}`}>
              <button
                className="calendar-row"
                aria-expanded={isOpen}
                aria-controls={isOpen ? `round-${r.round}` : undefined}
                onClick={() => setOpen(isOpen ? null : r.round)}
              >
                <span className="calendar-round">R{r.round}</span>
                <span className="calendar-race">
                  <b>{r.name}</b>
                  <span>
                    {r.locality}, {r.country}
                  </span>
                </span>
                <span className="calendar-when">
                  <b>{first && last ? weekendDates(first.start, last.start) : 'Dates TBC'}</b>
                  {race && <span>Race {fmtDayTime(race.start)}</span>}
                </span>
                <span className="calendar-chips">
                  {r.sessions.some((s) => s.key === 'sprint') && <span className="chip">Sprint</span>}
                  {live ? (
                    <span className="chip state-live">Live</span>
                  ) : isNext ? (
                    <span className="chip state-next">Next</span>
                  ) : (
                    done && <span className="chip">Finished</span>
                  )}
                </span>
              </button>
              {isOpen && <RoundDetail r={r} now={now} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
