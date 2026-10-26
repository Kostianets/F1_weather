import { useEffect, useState } from 'react'
import { getDriverStandings } from '../api/standings'
import { contenders, pointsLeft } from '../lib/standings'
import type { DriverStandings, NextRace } from '../types'

interface Props {
  next: NextRace
  now: number
}

export default function Standings({ next, now }: Props) {
  const { season } = next.race
  const [data, setData] = useState<DriverStandings | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    getDriverStandings(season).then(
      (res) => alive && setData(res),
      (err: Error) => alive && setError(err.message),
    )
    return () => {
      alive = false
    }
  }, [season, attempt])

  let body
  let note = null
  if (error) {
    body = (
      <div className="results-state" role="alert">
        <span>{error}</span>
        <button
          onClick={() => {
            setError(null)
            setAttempt((n) => n + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  } else if (data === undefined) {
    body = (
      <div className="results-state" role="status">
        Loading standings…
      </div>
    )
  } else if (data === null || data.drivers.length === 0) {
    body = <div className="results-state">No standings yet. They appear after the first race of the season.</div>
  } else {
    const left = pointsLeft(next.races, data.round, now)
    const inIt = contenders(data.drivers, left)
    const settled = inIt.size === 1
    const lead = data.drivers[0].points
    note = (
      <span className="note">
        After round {data.round} · <b>{left}</b> points left ·{' '}
        {settled ? 'title decided' : <><b>{inIt.size}</b> drivers can still win the title</>}
      </span>
    )
    body = (
      <table className="results-table standings-table">
        <thead>
          <tr>
            <th className="num">Pos</th>
            <th>Driver</th>
            <th className="col-wide">Team</th>
            <th className="num">Wins</th>
            <th className="num">Pts</th>
            <th className="num">Gap</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.drivers.map((d) => {
            const alive = inIt.has(d.code)
            return (
              <tr key={d.code} className={alive ? undefined : 'out'}>
                <td className="num">{d.pos}</td>
                <td className="results-driver">
                  <b>{d.code}</b>
                  <span className="col-wide">{d.name}</span>
                </td>
                <td className="col-wide">{d.team}</td>
                <td className="num">{d.wins}</td>
                <td className="num">{d.points}</td>
                <td className="num">{d.points === lead ? '–' : `−${lead - d.points}`}</td>
                <td>
                  {alive &&
                    (settled ? <span className="chip state-champion">Champion</span> : <span className="chip state-contender">Contender</span>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <section>
      <div className="panel-head">
        <h2>{season} drivers' championship</h2>
        {note}
      </div>
      <div className="panel standings">{body}</div>
    </section>
  )
}
