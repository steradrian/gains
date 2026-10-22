/* Me photos M1: progress photos, the data behind the Me > Body > Photos tab. No JSX.
 *
 * Two kinds of photo show in one grid:
 *  - own (`S.bodyPhotos = [{ id, d, ref, addedAt }]`): added from Me, tied to no workout. `ref` is
 *    a MediaRef (lib/media-refs.js), a still image only. Synced as a list merged by id
 *    (lib/sync-merge.js mergeBodyPhotos); a removal is a tombstone in `S.deleted.bodyPhotos[id]`.
 *    Their files go to the account only while `S.photoBackup === true` (Back up photos): off, the
 *    sync leaves them on this device (lib/media-sync.js, media-refs.js heldBackHashes). Turning it
 *    off later only stops new uploads; a file already sent stays on the server, still referenced,
 *    until its photo is deleted. Nothing is encrypted: the server keeps the files private to the
 *    account (api/media.js), which is all the copy may claim.
 *  - workout: the still photos attached to saved workouts (`workout.media`, lib/workout-media.js),
 *    uploaded as they always were. Removing one takes it off its workout (removeWorkoutMedia).
 *
 * Every reader goes through normalizeMediaRef, and a reading never rewrites the list: an entry
 * this version cannot show stays on the record, and keeps its file.
 */
import { normalizeMediaRef, workoutMediaOf, referencedHashes } from '../media-refs.js'
import { removeWorkoutMedia } from '../workout-media.js'
import { todayISO, uid } from '../format.js'

const list = v => (Array.isArray(v) ? v : [])
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const OWN = 'own:'
const WORKOUT = 'workout:'

/* ---- Workout photos ---- */

/**
 * Every still photo (no video — the comparison wants two stills, not two clips) across every
 * logged workout, newest first. Each entry carries the date and the workout it came from, so the
 * grid and the comparator can both say when a photo was taken without re-deriving it.
 */
export function progressPhotosOf(S) {
  const out = []
  for (const w of (S && S.workouts) || []) {
    for (const m of workoutMediaOf(w)) {
      if (m.kind === 'video') continue
      // `key`: the same file can sit on two workouts (one hash), and each is its own photo here.
      out.push({ key: (w.id || w.start || w.d) + ':' + m.hash, d: w.d, start: w.start || 0, w, m })
    }
  }
  out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.start - a.start))
  return out
}

/** Whole days between two ISO dates, always ≥ 0 regardless of which comes first. */
export function daysBetween(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')
  return Math.abs(Math.round(ms / 86400000))
}

/* ---- The photo model ---- */

const realDay = d => {
  if (typeof d !== 'string' || !DAY_RE.test(d)) return false
  const t = new Date(d + 'T12:00:00Z')
  return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d
}
/** A progress photo's ref as it may be shown: a MediaRef normalizeMediaRef accepts, a still image. */
const photoRef = ref => {
  const m = normalizeMediaRef(ref)
  return m && m.kind === 'image' ? m : null
}

/** That day's weigh-in, in the profile's own unit (S.bodyweight is kept in `S.unit`), or null. */
function weightOn(S, d) {
  let best = null
  for (const e of list(S?.bodyweight)) {
    if (!isObj(e) || e.d !== d || !(Number(e.w) > 0)) continue
    if (!best || (Number(e.t) || 0) > (Number(best.t) || 0)) best = e
  }
  return best ? Number(best.w) : null
}

/** Hashes something other than a progress photo refers to: those files go up whatever the switch says. */
const otherHashes = S => referencedHashes({ ...(isObj(S) ? S : {}), bodyPhotos: [] })

/**
 * Every progress photo, own and from workouts, newest first (by day, then the latest added or
 * logged): [{ key, d, ref, source: 'own' | 'workout', weight, backup, ... }]. `weight` is that
 * day's weigh-in in `S.unit`, or null. `backup` is true when the file is or will be uploaded: a
 * workout's always, an own one while Back up photos is on or when a workout or an exercise also
 * holds that file. Own entries also carry `id` and `addedAt`, workout ones `w` (the workout) and
 * `start`. An own entry with no readable ref or day is left out (and left on the record).
 */
export function allPhotos(S) {
  if (!isObj(S)) return []
  const on = S.photoBackup === true
  const others = on ? null : otherHashes(S)
  const out = []
  for (const p of list(S.bodyPhotos)) {
    if (!isObj(p) || p.id == null || !realDay(p.d)) continue
    const ref = photoRef(p.ref)
    if (!ref) continue
    out.push({ key: OWN + p.id, id: p.id, d: p.d, ref, source: 'own', weight: weightOn(S, p.d), backup: on || others.has(ref.hash), addedAt: Number(p.addedAt) || 0, at: Number(p.addedAt) || 0 })
  }
  for (const p of progressPhotosOf(S)) {
    out.push({ key: WORKOUT + p.key, d: p.d, ref: p.m, source: 'workout', weight: weightOn(S, p.d), backup: true, w: p.w, start: p.start, at: p.start })
  }
  out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.at - a.at))
  return out.map(({ at, ...p }) => p)
}

/**
 * Adds a progress photo taken on day `d` (YYYY-MM-DD) to `state` — mutates it, made for useStore's
 * update(). 'added', or why not: 'invalid' (no real day, or not a still image normalizeMediaRef
 * accepts) or 'dup' (that very file is already a photo of that day, own or a workout's).
 */
export function addPhoto(state, { d, ref } = {}, now = Date.now()) {
  if (!isObj(state)) return 'invalid'
  const m = photoRef(ref)
  if (!m || !realDay(d)) return 'invalid'
  const raw = list(state.bodyPhotos)
  if (raw.some(p => isObj(p) && p.d === d && isObj(p.ref) && p.ref.hash === m.hash)) return 'dup'
  if (allPhotos(state).some(p => p.d === d && p.ref.hash === m.hash)) return 'dup'
  state.bodyPhotos = [...raw, { id: uid(), d, ref: m, addedAt: now }]
  return 'added'
}

/**
 * Removes the photo `key` (an allPhotos key) from `state` — mutates it. An own photo leaves its
 * tombstone in `deleted.bodyPhotos` (the store's stampChange stamps it again at the change's own
 * time; written here too so a caller outside update() cannot remove one without it). A workout's
 * photo is taken off its workout (removeWorkoutMedia). Returns what went, for an Undo — `{ source:
 * 'own', entry }` or `{ source: 'workout', w, ref }` — or null when nothing matched. The file
 * itself is left to the GCs: hold its hashes (mediaStore.hold) while an Undo is on offer.
 */
export function removePhoto(state, key, now = Date.now()) {
  if (!isObj(state) || typeof key !== 'string') return null
  if (key.startsWith(OWN)) {
    const id = key.slice(OWN.length)
    const raw = list(state.bodyPhotos)
    const named = p => isObj(p) && p.id != null && String(p.id) === id
    const entry = raw.find(named)
    if (!entry) return null
    // Every copy of that id: the tombstone names the id, so a twin left behind would go anyway.
    state.bodyPhotos = raw.filter(p => !named(p))
    const del = isObj(state.deleted) ? state.deleted : (state.deleted = {})
    const m = isObj(del.bodyPhotos) ? del.bodyPhotos : (del.bodyPhotos = {})
    m[String(entry.id)] = Math.max(now, (Number(entry.addedAt) || 0) + 1)
    return { source: 'own', entry }
  }
  if (key.startsWith(WORKOUT)) {
    const p = allPhotos(state).find(x => x.key === key)
    if (!p || !removeWorkoutMedia(state, p.w, p.ref.hash, now)) return null
    return { source: 'workout', w: p.w, ref: p.ref }
  }
  return null
}

/**
 * Puts back an own photo removePhoto took (its `entry`), unless one with that id is there again.
 * The store's stampChange records the add-back over the tombstone. Mutates `state`; returns
 * whether it went back.
 */
export function restorePhoto(state, entry) {
  if (!isObj(state) || !isObj(entry) || entry.id == null) return false
  const raw = list(state.bodyPhotos)
  if (raw.some(p => isObj(p) && String(p.id) === String(entry.id))) return false
  state.bodyPhotos = [...raw, JSON.parse(JSON.stringify(entry))]
  return true
}

/** Back up photos on or off (`S.photoBackup`, a synced setting). Mutates `state`. */
export function setPhotoBackup(state, on) {
  if (isObj(state)) state.photoBackup = on === true
}

/** How many own photos are on this device only: Back up photos off, and no workout or exercise
 *  holding the same file. */
export function localOnlyCount(S) {
  return allPhotos(S).filter(p => p.source === 'own' && !p.backup).length
}

/**
 * Where a photo's file is, for the grid: 'local' (this device has it), 'remote' (not here, but it
 * is or will be on the server: fetch it, lib/media-sync.js fetchToStore) or 'missing' (not here
 * and never uploaded: "On another phone"). `local` is whether this device's store has the file;
 * `fetch` the outcome of a download already tried ('missing' when the server answered 404). An
 * own photo taken while Back up photos was on and kept after it was turned off is on the server
 * but reads as 'missing' here: a caller may still try a fetch (mayFetch) before it says so.
 */
export function photoState(photo, { local = false, fetch = null } = {}) {
  if (local) return 'local'
  if (fetch === 'missing') return 'missing'
  return photo && photo.backup ? 'remote' : 'missing'
}
