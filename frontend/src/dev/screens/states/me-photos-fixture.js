// The Photos tab's states (me-photos.jsx): the board's six photos, a fortnight or three weeks apart,
// each with that day's weigh-in, counted back from today so the page and the Add photo drawer agree on
// the day (the drawer reads the real clock). No file is ever written: the pictures come from
// ds/dev-still.js through PhotoSourceContext.
import { isoOf, todayISO } from '../../../lib/format.js'

export const NOOP = () => {}

// Newest first, as the board lists them: [days back, kg].
const SIX = [[0, 81.4], [14, 82.1], [28, 83.0], [42, 83.6], [56, 84.3], [77, 85.0]]
const LB = kg => Math.round(kg * 2.20462 * 10) / 10

const daysAgo = n => { const d = new Date(todayISO() + 'T12:00:00'); d.setDate(d.getDate() - n); return isoOf(d) }
const hashOf = i => i.toString(16).padStart(64, '0')

/** The hash of the photo that reads "On another phone" when `gone` is set. */
export const GONE_HASH = hashOf(2)

const ref = i => ({ kind: 'image', hash: hashOf(i + 1), mime: 'image/jpeg', size: 120000, width: 900, height: 1200, at: 0 })

/**
 * The state a Photos screen reads. `count` photos of the six (newest first); `backup` is Back up
 * photos; `unit` kg or lb; `weights: false` leaves out the weigh-ins (tiles without a weight line).
 */
export function photosState({ count = SIX.length, backup = false, unit = 'kg', weights = true } = {}) {
  const rows = SIX.slice(0, count)
  return {
    unit,
    photoBackup: backup,
    bodyweight: weights ? rows.map(([n, kg]) => ({ d: daysAgo(n), w: unit === 'lb' ? LB(kg) : kg })).reverse() : [],
    bodyPhotos: rows.map(([n], i) => ({ id: 'p' + i, d: daysAgo(n), ref: ref(i), addedAt: Date.now() - n * 864e5 })).reverse(),
    workouts: [],
    targetW: null,
  }
}

/** Nothing yet. */
export const emptyState = () => photosState({ count: 0 })

/** The picture source for the gallery: a still for every photo, "not here" for the one `gone` names. */
export const sourceOf = (STILL, { gone = false } = {}) => photo =>
  gone && photo.ref.hash === GONE_HASH ? { url: null, status: 'missing' } : { url: STILL, status: 'ready' }
