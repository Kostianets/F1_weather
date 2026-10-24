const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz })
    formatters.set(key, f)
  }
  return f
}

/** Formats an instant in the given IANA time zone (the viewer's own when omitted). */
export function fmt(ms: number, tz: string | undefined, opts: Intl.DateTimeFormatOptions): string {
  return formatter(tz, opts).format(ms)
}

export const fmtTime = (ms: number, tz?: string) => fmt(ms, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const fmtDay = (ms: number, tz?: string) => fmt(ms, tz, { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtWeekday = (ms: number, tz?: string) => fmt(ms, tz, { weekday: 'short' })
export const fmtDayTime = (ms: number, tz?: string) => `${fmt(ms, tz, { weekday: 'short' })} ${fmtTime(ms, tz)}`

/** Short zone name at that instant, e.g. "CET" or "GMT-5". */
export function fmtZone(ms: number, tz?: string): string {
  return formatter(tz, { timeZoneName: 'short' }).formatToParts(ms).find((p) => p.type === 'timeZoneName')?.value ?? ''
}

export function localHour(ms: number, tz?: string): number {
  return Number(fmt(ms, tz, { hour: 'numeric', hourCycle: 'h23' }))
}

/** Calendar day key, for telling whether two instants fall on the same local day. */
export const dayKey = (ms: number, tz?: string) => fmt(ms, tz, { year: 'numeric', month: '2-digit', day: '2-digit' })

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

export function compass(deg: number | null | undefined): string {
  if (deg == null) return '–'
  return POINTS[Math.round(deg / 22.5) % 16]
}

export function countdownParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}
