import { useStore } from '../../store/useStore.js'
import { mediaStore } from '../media-store.js'
import { normalizeMediaRef } from '../media-refs.js'
import { newUuid } from './diary.js'
import { TOMBSTONE_KEEP_MS, isTombstone, stampOfExtras } from './recipe-extras-merge.js'

// What a recipe has that the hub's record has not (it takes name, notes, ingredients, servings,
// weight and nutrition, never an image or a method), kept in Gains' own synced state under the
// recipe's id:
//
//   S.recipeExtras[mealId] = { steps, photo, makesTyped, updatedAt }
//   steps       [{ id, text }], the method, in order
//   photo       a MediaRef (lib/media-refs.js) of a photo in the media store; media sync uploads it
//               (it is put there as pending, and media-refs.js counts it as referenced)
//   makesTyped  the person typed the cooked weight, so Makes no longer follows the ingredients
//   updatedAt   when this recipe's extras were last written: two devices merge per recipe on it
//
// A recipe that is really deleted, or whose extras were all cleared, leaves
// { deleted: true, updatedAt } in its place, so another device cannot bring the steps and the
// photo back (lib/nutrition/recipe-extras-merge.js, used by mergeStates). A deleted recipe's
// extras go when its delete is sent (delete-undo.js), so Undo brings back the steps and the photo
// with it.
//
// Before they synced they lived in this browser's localStorage; migrateLocalExtras moves them over
// once.

const LEGACY_KEY = 'gains_recipe_extras_v1'
// Typing a step is a write per key; the state is persisted and pushed once the typing pauses.
const FLUSH_MS = 600

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

const storeBackend = {
  read() {
    const all = useStore.getState().S?.recipeExtras
    return isMap(all) ? all : {}
  },
  write(all) {
    useStore.getState().update(S => { S.recipeExtras = all })
  },
}

let backend = storeBackend

/** The screens gallery's: extras held in memory, so nothing a state is tapped into reaches
 *  the store. Returns the function that puts the real state back. */
export function holdExtrasInMemory(initial = {}) {
  let all = JSON.parse(JSON.stringify(initial))
  backend = { read: () => all, write: next => { all = next }, memory: true }
  return () => { backend = storeBackend }
}

const normalize = raw => ({
  steps: (Array.isArray(raw?.steps) ? raw.steps : [])
    .filter(s => s && typeof s.text === 'string' && s.text.trim())
    .map(s => ({ id: typeof s.id === 'string' && s.id ? s.id : newUuid(), text: s.text })),
  photo: normalizeMediaRef(raw?.photo),
  makesTyped: raw?.makesTyped === true,
})

const isEmpty = kept => !kept.steps.length && !kept.photo && !kept.makesTyped
const contentOf = e => JSON.stringify([e.steps, e.photo, e.makesTyped])
const isLive = e => isMap(e) && !isTombstone(e)

// A tombstone older than TOMBSTONE_KEEP_MS goes: the recipe id is not reused, so it only guarded
// against a device that has been away for half a year.
function pruned(all, now) {
  for (const [k, e] of Object.entries(all)) {
    if (isTombstone(e) && now - stampOfExtras(e) > TOMBSTONE_KEEP_MS) delete all[k]
  }
  return all
}

// Writes not yet in the state, by recipe id: a kept entry (no stamp yet) or null for none.
const waiting = new Map()
let timer = null

/** The extras of recipe `id`, or null when it has none. */
export function extrasOf(id) {
  const key = String(id)
  if (waiting.has(key)) return waiting.get(key)
  const raw = backend.read()[key]
  return isLive(raw) ? normalize(raw) : null
}

/** Puts the waiting writes into the state now: one update for however many were typed. */
export function flushExtras() {
  clearTimeout(timer)
  timer = null
  if (!waiting.size) return
  const batch = [...waiting]
  waiting.clear()
  const all = { ...backend.read() }
  const now = Date.now()
  let changed = false
  for (const [key, kept] of batch) {
    const cur = all[key]
    if (kept === null) {
      if (!isLive(cur)) continue
      if (backend.memory) delete all[key]
      else all[key] = { deleted: true, updatedAt: Math.max(now, stampOfExtras(cur) + 1) }
    } else {
      if (isLive(cur) && contentOf(normalize(cur)) === contentOf(kept)) continue
      all[key] = { ...kept, updatedAt: Math.max(now, stampOfExtras(cur) + 1) }
    }
    changed = true
  }
  if (changed) backend.write(pruned(all, now))
}

/** Keeps the extras of recipe `id`; blank steps are left out, and a recipe with nothing to keep
 *  has no entry. */
export function saveExtras(id, extras) {
  const kept = normalize(extras)
  waiting.set(String(id), isEmpty(kept) ? null : kept)
  if (backend.memory) { flushExtras(); return }
  clearTimeout(timer)
  timer = setTimeout(flushExtras, FLUSH_MS)
}

/** The recipe is really gone: its extras are replaced by a tombstone, which syncs. */
export function dropExtras(id) {
  const key = String(id)
  waiting.delete(key)
  flushExtras()
  const all = { ...backend.read() }
  if (!(key in all)) return
  if (backend.memory) { delete all[key]; backend.write(all); return }
  const now = Date.now()
  all[key] = { deleted: true, updatedAt: Math.max(now, stampOfExtras(all[key]) + 1) }
  backend.write(pruned(all, now))
}

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('pagehide', flushExtras)
  globalThis.addEventListener('visibilitychange', () => { if (globalThis.document?.visibilityState === 'hidden') flushExtras() })
}

/**
 * Moves what the device kept in localStorage before the extras synced into the state, once: a
 * recipe the state already has an entry for (live or deleted) is left as it is, the rest come in
 * stamped 1 so any real write from another device wins over them. Their photos are put back in
 * the media store as pending, which is what makes media sync upload them. The old copy goes only
 * after the state has it. Safe to call on every start.
 */
export async function migrateLocalExtras() {
  if (backend.memory) return
  let old
  try {
    old = JSON.parse(globalThis.localStorage?.getItem(LEGACY_KEY) || 'null')
  } catch { return }
  if (old === null) return
  const forget = () => { try { globalThis.localStorage?.removeItem(LEGACY_KEY) } catch { /* blocked */ } }
  if (!isMap(old)) { forget(); return }

  const mine = {}
  for (const [key, raw] of Object.entries(old)) {
    const kept = isMap(raw) ? normalize(raw) : null
    if (kept && !isEmpty(kept)) mine[key] = kept
  }
  for (const kept of Object.values(mine)) {
    for (const ref of [kept.photo, kept.photo?.poster]) {
      if (!ref) continue
      try {
        const have = await mediaStore.get(ref.hash)
        if (have) await mediaStore.put(ref.hash, have.blob, { mime: have.mime, pending: true })
      } catch { /* the file is gone or the store is unavailable: the entry still comes in */ }
    }
  }
  const all = { ...backend.read() }
  let changed = false
  for (const [key, kept] of Object.entries(mine)) {
    if (key in all) continue
    all[key] = { ...kept, updatedAt: 1 }
    changed = true
  }
  if (changed) backend.write(all)
  forget()
}
