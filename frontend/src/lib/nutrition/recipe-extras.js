import { normalizeMediaRef } from '../media-refs.js'
import { newUuid } from './diary.js'

// What a recipe has that the hub's record has not (it takes name, notes, ingredients, servings,
// weight and nutrition, never an image or a method), kept on this device under the recipe's id:
//   steps       [{ id, text }], the method, in order
//   photo       a MediaRef (lib/media-refs.js) of a photo in the local media store; nothing is sent
//   makesTyped  the person typed the cooked weight, so Makes no longer follows the ingredients
// Nothing here goes to a server. The photo's file is kept from the local clean-up through
// recipePhotoHashes (lib/media-sync.js localMediaGc). A deleted recipe's extras go when its delete
// is sent (delete-undo.js), so Undo brings back the steps and the photo with it.

const KEY = 'gains_recipe_extras_v1'

const storageBackend = {
  read() {
    try {
      const value = JSON.parse(globalThis.localStorage?.getItem(KEY) || 'null')
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    } catch { return {} }
  },
  write(all) {
    try { globalThis.localStorage?.setItem(KEY, JSON.stringify(all)) } catch { /* full or blocked: they live in the open editor only */ }
  },
}

let backend = storageBackend

/** The screens gallery's: extras held in memory, so nothing a state is tapped into reaches
 *  storage. Returns the function that puts the real storage back. */
export function holdExtrasInMemory(initial = {}) {
  let all = JSON.parse(JSON.stringify(initial))
  backend = { read: () => all, write: next => { all = next } }
  return () => { backend = storageBackend }
}

const normalize = raw => ({
  steps: (Array.isArray(raw?.steps) ? raw.steps : [])
    .filter(s => s && typeof s.text === 'string' && s.text.trim())
    .map(s => ({ id: typeof s.id === 'string' && s.id ? s.id : newUuid(), text: s.text })),
  photo: normalizeMediaRef(raw?.photo),
  makesTyped: raw?.makesTyped === true,
})

/** The extras of recipe `id`, or null when it has none. */
export function extrasOf(id) {
  const raw = backend.read()[String(id)]
  return raw && typeof raw === 'object' ? normalize(raw) : null
}

/** Keeps the extras of recipe `id`; blank steps are left out, and a recipe with nothing to keep
 *  has no entry. */
export function saveExtras(id, extras) {
  const all = { ...backend.read() }
  const kept = normalize(extras)
  if (!kept.steps.length && !kept.photo && !kept.makesTyped) delete all[String(id)]
  else all[String(id)] = kept
  backend.write(all)
}

export function dropExtras(id) {
  const all = { ...backend.read() }
  if (!(String(id) in all)) return
  delete all[String(id)]
  backend.write(all)
}

/** Every file a recipe's photo points at, for the local clean-up to keep. */
export function recipePhotoHashes() {
  const out = new Set()
  for (const raw of Object.values(backend.read())) {
    const photo = normalizeMediaRef(raw?.photo)
    if (photo) {
      out.add(photo.hash)
      if (photo.poster) out.add(photo.poster.hash)
    }
  }
  return out
}
