import type { Race, Standing } from '../types'

/** The most points one entry can score in a race and in a sprint. */
export interface PointsPerRound {
  race: number
  sprint: number
}

export const DRIVER_MAX: PointsPerRound = { race: 25, sprint: 8 }
// A team scores with both cars: first and second place.
export const TEAM_MAX: PointsPerRound = { race: 25 + 18, sprint: 8 + 7 }

/**
 * The most points one entry can still score after the standings' round. That round's
 * race still counts while it hasn't ended, since standings can be published after the
 * sprint alone; a later round counts in full even if it has run, until its standings
 * are out.
 */
export function pointsLeft(races: Race[], standingsRound: number, now: number, max = DRIVER_MAX): number {
  let left = 0
  for (const r of races) {
    if (r.round < standingsRound) continue
    for (const s of r.sessions) {
      if (s.key === 'race' && (r.round > standingsRound || s.end > now)) left += max.race
      if (s.key === 'sprint' && r.round > standingsRound) left += max.sprint
    }
  }
  return left
}

/**
 * The entries that can still win the title. Drawing level with the leader counts,
 * because a tie goes to countback, which the remaining races can still decide.
 */
export function contenders<T extends Standing>(rows: T[], left: number): Set<T> {
  const lead = Math.max(0, ...rows.map((r) => r.points))
  return new Set(rows.filter((r) => r.points + left >= lead))
}
