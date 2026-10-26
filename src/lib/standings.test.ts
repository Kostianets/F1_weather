import { describe, expect, it } from 'vitest'
import { toRace } from '../api/schedule'
import type { ApiRace } from '../api/schedule'
import fallbackSeason from '../data/season-fallback.json'
import type { DriverStanding } from '../types'
import { contenders, pointsLeft } from './standings'

const races = (fallbackSeason as ApiRace[]).map(toRace)
const sprintRounds = races.filter((r) => r.sessions.some((s) => s.key === 'sprint')).map((r) => r.round)
const raceEnd = (round: number) => races[round - 1].sessions.find((s) => s.key === 'race')!.end

const driver = (code: string, points: number): DriverStanding => ({ code, name: code, team: 'Team', pos: 0, points, wins: 0 })

describe('pointsLeft', () => {
  it('counts a win in every later race and sprint', () => {
    const last = races.length
    const later = races.filter((r) => r.round > last - 3)
    const sprints = later.filter((r) => sprintRounds.includes(r.round)).length
    expect(pointsLeft(races, last - 3, raceEnd(last - 3) + 1)).toBe(3 * 25 + sprints * 8)
  })

  it('still counts the race of a round whose standings came after the sprint', () => {
    const round = sprintRounds[0]
    const afterSprint = pointsLeft(races, round, raceEnd(round) - 1)
    expect(afterSprint - pointsLeft(races, round, raceEnd(round) + 1)).toBe(25)
  })

  it('leaves nothing once the final race has ended', () => {
    expect(pointsLeft(races, races.length, raceEnd(races.length) + 1)).toBe(0)
  })
})

describe('contenders', () => {
  const drivers = [driver('ANT', 365), driver('RUS', 242), driver('HAM', 241), driver('LEC', 200)]

  it('keeps everyone who can still reach the leader, a tie included', () => {
    expect([...contenders(drivers, 124)]).toEqual(['ANT', 'RUS', 'HAM'])
    expect([...contenders(drivers, 123)]).toEqual(['ANT', 'RUS'])
  })

  it('leaves only the champion once the gap is out of reach', () => {
    expect([...contenders(drivers, 122)]).toEqual(['ANT'])
  })
})
