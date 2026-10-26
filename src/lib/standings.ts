import type { DriverStanding, Race } from '../types'

const RACE_WIN = 25
const SPRINT_WIN = 8

/**
 * The most points one driver can still score after the standings' round. That round's
 * race still counts while it hasn't ended, since standings can be published after the
 * sprint alone; a later round counts in full even if it has run, until its standings
 * are out.
 */
export function pointsLeft(races: Race[], standingsRound: number, now: number): number {
  let left = 0
  for (const r of races) {
    if (r.round < standingsRound) continue
    for (const s of r.sessions) {
      if (s.key === 'race' && (r.round > standingsRound || s.end > now)) left += RACE_WIN
      if (s.key === 'sprint' && r.round > standingsRound) left += SPRINT_WIN
    }
  }
  return left
}

/**
 * Codes of the drivers who can still win the title. Drawing level with the leader
 * counts, because a tie goes to countback, which the remaining races can still decide.
 */
export function contenders(drivers: DriverStanding[], left: number): Set<string> {
  const lead = Math.max(0, ...drivers.map((d) => d.points))
  return new Set(drivers.filter((d) => d.points + left >= lead).map((d) => d.code))
}
