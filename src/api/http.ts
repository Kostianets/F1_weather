const DEFAULT_TIMEOUT = 12_000

/** Fetches JSON, giving up after a timeout and turning failures into readable messages. */
export async function getJson<T = unknown>(url: string, service: string, timeout = DEFAULT_TIMEOUT): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new Error(`${service} did not respond in time`)
    throw new Error(`${service} is unreachable`)
  }
  if (!res.ok) throw new Error(`${service} responded with error ${res.status}`)
  try {
    return (await res.json()) as T
  } catch {
    throw new Error(`${service} sent an unreadable response`)
  }
}

/** Throws when a response is missing something we rely on, so a format change fails loudly and early. */
export function expect(condition: unknown, service: string): asserts condition {
  if (!condition) throw new Error(`${service} sent data in an unexpected format`)
}
