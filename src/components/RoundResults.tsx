import { useEffect, useState } from 'react'
import { getRoundResults } from '../api/results'
import type { QualiResult, RaceResult, RoundResults as Results } from '../types'

interface Props {
  season: string
  round: number
}

type Tab = keyof Results

const TABS: { key: Tab; label: string }[] = [
  { key: 'race', label: 'Race' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'quali', label: 'Qualifying' },
]

// Kept for the life of the page, but only once the race is classified: until then a
// later look can find sessions that weren't published the first time.
const cache = new Map<string, Results>()

const NOT_CLASSIFIED: Record<string, string> = { R: 'DNF', D: 'DSQ', E: 'EX', W: 'DNS', F: 'DNQ', N: 'NC' }

function Driver({ r }: { r: RaceResult | QualiResult }) {
  return (
    <td className="results-driver">
      <b>{r.code}</b>
      <span className="col-wide">{r.name}</span>
      {'fastestLap' in r && r.fastestLap && (
        <span className="results-fl" title="Fastest lap">
          FL
        </span>
      )}
    </td>
  )
}

function Gained({ n }: { n: number | null }) {
  if (n == null) return <td className="col-wide num">–</td>
  if (n === 0) return <td className="col-wide num">=</td>
  return <td className={`col-wide num ${n > 0 ? 'gain' : 'loss'}`}>{n > 0 ? `+${n}` : `−${-n}`}</td>
}

function RaceTable({ rows }: { rows: RaceResult[] }) {
  return (
    <table className="results-table">
      <thead>
        <tr>
          <th className="num">Pos</th>
          <th>Driver</th>
          <th className="col-wide">Team</th>
          <th className="col-wide num">Grid</th>
          <th className="col-wide num" title="Places gained">+/−</th>
          <th>Time / status</th>
          <th className="num">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code}>
            <td className="num">{NOT_CLASSIFIED[r.pos] ?? r.pos}</td>
            <Driver r={r} />
            <td className="col-wide">{r.team}</td>
            <td className="col-wide num">{r.grid ?? 'Pit'}</td>
            <Gained n={r.gained} />
            <td>{r.result}</td>
            <td className="num">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function QualiTable({ rows }: { rows: QualiResult[] }) {
  return (
    <table className="results-table">
      <thead>
        <tr>
          <th className="num">Pos</th>
          <th>Driver</th>
          <th className="col-wide">Team</th>
          <th>Q1</th>
          <th>Q2</th>
          <th>Q3</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code}>
            <td className="num">{r.pos}</td>
            <Driver r={r} />
            <td className="col-wide">{r.team}</td>
            <td>{r.q1 ?? '–'}</td>
            <td>{r.q2 ?? '–'}</td>
            <td>{r.q3 ?? '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function RoundResults({ season, round }: Props) {
  const key = `${season}/${round}`
  const [data, setData] = useState(() => cache.get(key) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState<Tab | null>(null)

  useEffect(() => {
    if (cache.has(key)) return
    let alive = true
    getRoundResults(season, round).then(
      (res) => {
        if (res.race) cache.set(key, res)
        if (alive) setData(res)
      },
      (err: Error) => alive && setError(err.message),
    )
    return () => {
      alive = false
    }
  }, [key, season, round, attempt])

  if (error) {
    return (
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
  }
  if (!data) {
    return (
      <div className="results-state" role="status">
        Loading results…
      </div>
    )
  }

  const tabs = TABS.filter((t) => data[t.key])
  if (tabs.length === 0) return <div className="results-state">No results published yet.</div>
  const active = tab && data[tab] ? tab : tabs[0].key

  return (
    <div className="results">
      <div className="tabs" aria-label="Results">
        {tabs.map((t) => (
          <button key={t.key} className={t.key === active ? 'on' : ''} aria-pressed={t.key === active} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {active === 'quali' ? <QualiTable rows={data.quali!} /> : <RaceTable rows={data[active]!} />}
    </div>
  )
}
