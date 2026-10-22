// How two copies of S.recipeExtras meet (lib/sync-merge.js mergeStates). Pure, so the merge and
// the media rules can use it without the store.
//
//   S.recipeExtras = { '<meal id>': { steps, photo, makesTyped, updatedAt }
//                    | { deleted: true, updatedAt } }
//
// One entry per recipe, merged whole by its own `updatedAt`: two devices that each wrote a
// different recipe keep both, and the same recipe keeps the later write. A recipe that is really
// deleted leaves a tombstone, not a missing key: a missing key would come straight back from a
// device that still holds the steps and the photo, and the photo would stay referenced for ever.

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** How long a tombstone is kept. A recipe id is never reused, so a tombstone that is gone only
 *  lets a stale device bring back extras of a recipe nobody can open. */
export const TOMBSTONE_KEEP_MS = 180 * 24 * 3600 * 1000

export const stampOfExtras = e => (isMap(e) ? Number(e.updatedAt) || 0 : 0)
export const isTombstone = e => isMap(e) && e.deleted === true

// On a tie the removal wins, then the larger JSON: the same answer from either side.
function later(x, y) {
  const sx = stampOfExtras(x), sy = stampOfExtras(y)
  if (sx !== sy) return sx > sy ? x : y
  if (isTombstone(x) !== isTombstone(y)) return isTombstone(x) ? x : y
  return JSON.stringify(x) >= JSON.stringify(y) ? x : y
}

/**
 * The union of both copies' recipes. Of a recipe both have, the entry written last (a removal
 * included). With `prefer` (a sign-in), `newer` is the preferred side's and its entry stands, as
 * for the other stamped maps (mergeStampedMap): the other side only adds the recipes it alone has.
 */
export function mergeRecipeExtras(newer, older, prefer) {
  const n = isMap(newer) ? newer : {}
  const o = isMap(older) ? older : {}
  const out = {}
  for (const k of new Set([...Object.keys(o), ...Object.keys(n)])) {
    const x = isMap(n[k]) ? n[k] : null, y = isMap(o[k]) ? o[k] : null
    if (x && y) out[k] = prefer ? x : later(x, y)
    else if (x || y) out[k] = x || y
  }
  return out
}
