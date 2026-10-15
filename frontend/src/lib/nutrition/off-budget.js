// How many Open Food Facts searches this person can still spend (fitness-eval ux-search.md §5,
// api-diary-index.md §8). The hub lets 30 a minute through /api/proxy, shared with barcode
// lookups, and answers a 429 past that. The global search must not burn them on every keystroke:
// it searches by itself only while the budget has room for 20 a minute, and keeps 10 for the
// searches a person asks for with a tap.
//
// The hub's own count wins when it sends one (RateLimit-Remaining, right across tabs and devices):
// an automatic search while more than 10 remain, a tap while any does. Without the header (an
// older hub, the first call) a local count of the last minute stands in. A 429 pauses every search
// for its Retry-After (15 s when it says nothing, 60 s at most), and the countdown is shown.
import { create } from 'zustand'

export const AUTO_PER_MIN = 20
export const TAP_RESERVE = 10
export const CAP_PER_MIN = AUTO_PER_MIN + TAP_RESERVE
const MINUTE = 60_000
const PAUSE_DEFAULT_S = 15
const PAUSE_MAX_S = 60

/** `pausedUntil` (epoch ms, 0 when not paused) for the countdown line. */
export const useOffBudget = create(() => ({ pausedUntil: 0 }))

let spent = []          // { at, kind } of the last minute
let server = null       // { remaining, at } from the last answer that said

const recent = now => (spent = spent.filter(s => now - s.at < MINUTE))

/** Whether a search of this kind may go now: 'auto' (typed, not asked for) or 'tap'. */
export function canSearch(kind, now = Date.now()) {
  if (now < useOffBudget.getState().pausedUntil) return false
  if (server && now - server.at < MINUTE) return kind === 'tap' ? server.remaining > 0 : server.remaining > TAP_RESERVE
  const last = recent(now)
  if (kind === 'tap') return last.length < CAP_PER_MIN
  return last.filter(s => s.kind === 'auto').length < AUTO_PER_MIN && last.length < CAP_PER_MIN
}

/** A search is going out. */
export function noteSearch(kind, now = Date.now()) {
  recent(now).push({ at: now, kind })
  if (server) server = { ...server, remaining: Math.max(0, server.remaining - 1) }
}

/** What an answer says about the budget: its RateLimit-Remaining, and a 429's Retry-After. */
export function noteAnswer(res, now = Date.now()) {
  const remaining = parseInt(res?.headers?.get?.('RateLimit-Remaining'), 10)
  if (Number.isFinite(remaining)) server = { remaining, at: now }
  if (res?.status === 429) {
    const after = parseInt(res.headers?.get?.('Retry-After'), 10)
    const s = Math.min(PAUSE_MAX_S, Number.isFinite(after) && after > 0 ? after : PAUSE_DEFAULT_S)
    useOffBudget.setState({ pausedUntil: now + s * 1000 })
    server = { remaining: 0, at: now }
  }
}

/** Seconds left on a pause, 0 when there is none. */
export const pausedFor = (now = Date.now()) => Math.max(0, Math.ceil((useOffBudget.getState().pausedUntil - now) / 1000))

/** Forgets everything (tests, sign-out). */
export function resetOffBudget() {
  spent = []
  server = null
  useOffBudget.setState({ pausedUntil: 0 })
}
