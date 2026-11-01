import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getDriverStandings, getTeamStandings } from '../api/standings'
import { DRIVER_MAX, TEAM_MAX, contenders, pointsLeft } from '../lib/standings'
import type { PointsPerRound } from '../lib/standings'
import type { NextRace, Standing, StandingsTable } from '../types'

interface Props {
  next: NextRace
  now: number
}

export default function Standings({ next, now }: Props) {
  return (
    <>
      <Championship
        title="drivers' championship"
        noun="drivers"
        load={getDriverStandings}
        max={DRIVER_MAX}
        next={next}
        now={now}
        rowKey={(d) => d.code}
        head={
          <>
            <th>Driver</th>
            <th className="col-wide">Team</th>
          </>
        }
        cells={(d) => (
          <>
            <td className="results-driver">
              <b>{d.code}</b>
              <span className="col-wide">{d.name}</span>
            </td>
            <td className="col-wide">{d.team}</td>
          </>
        )}
      />
      <Championship
        title="constructors' championship"
        noun="teams"
        load={getTeamStandings}
        max={TEAM_MAX}
        next={next}
        now={now}
        rowKey={(t) => t.id}
        head={<th>Team</th>}
        cells={(t) => <td>{t.name}</td>}
      />
    </>
  )
}

interface ChampionshipProps<T extends Standing> extends Props {
  title: string
  /** plural, for "N drivers can still win the title" */
  noun: string
  load: (season: string) => Promise<StandingsTable<T> | null>
  max: PointsPerRound
  rowKey: (row: T) => string
  /** header cells and row cells between Pos and Wins */
  head: ReactNode
  cells: (row: T) => ReactNode
}

function Championship<T extends Standing>({ next, now, title, noun, load, max, rowKey, head, cells }: ChampionshipProps<T>) {
  const { season } = next.race
  const [data, setData] = useState<StandingsTable<T> | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    load(season).then(
      (res) => alive && setData(res),
      (err: Error) => alive && setError(err.message),
    )
    return () => {
      alive = false
    }
  }, [load, season, attempt])

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
  } else if (data === null || data.rows.length === 0) {
    body = <div className="results-state">No standings yet. They appear after the first race of the season.</div>
  } else {
    const left = pointsLeft(next.races, data.round, now, max)
    const inIt = contenders(data.rows, left)
    const settled = inIt.size === 1
    const lead = data.rows[0].points
    note = (
      <span className="note">
        After round {data.round} · <b>{left}</b> points left ·{' '}
        {settled ? (
          'title decided'
        ) : (
          <>
            <b>{inIt.size}</b> {noun} can still win the title
          </>
        )}
      </span>
    )
    body = (
      <table className="results-table standings-table">
        <thead>
          <tr>
            <th className="num">Pos</th>
            {head}
            <th className="num">Wins</th>
            <th className="num">Pts</th>
            <th className="num">Gap</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => {
            const alive = inIt.has(r)
            return (
              <tr key={rowKey(r)} className={alive ? undefined : 'out'}>
                <td className="num">{r.pos}</td>
                {cells(r)}
                <td className="num">{r.wins}</td>
                <td className="num">{r.points}</td>
                <td className="num">{r.points === lead ? '–' : `−${lead - r.points}`}</td>
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
        <h2>
          {season} {title}
        </h2>
        {note}
      </div>
      <div className="panel standings">{body}</div>
    </section>
  )
}
