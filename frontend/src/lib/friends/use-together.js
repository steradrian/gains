import { useEffect, useState } from 'react'
import { workoutDay } from '../history.js'
import { friendsAvailable, getGroup } from './api.js'

// The "Trained together" moments that hold a given workout of the viewer's: GET /groups/{id}
// `moments` of kind `together` whose `who` includes the viewer, on the workout's day. The server
// makes the moment (same routine, same day, automatic), so when it is not there yet the answer is
// an empty list and nothing is promised: it shows up in the group view later. A failed read is the
// same empty list (no spinner, no error for a row that is only a bonus). A moment the viewer left
// this workout out of (`workout.share.together: false`) is not in `moments` but in the viewer's own
// `togetherOff`, so the row stays and can be switched on again.

let mock = null

/** The gallery's and the tests' seam: `list` is shown instead of any request. Returns the way back. */
export function __setMockTogether(list) {
  mock = list
  return () => { mock = null }
}

// A moment's `at` is a timestamp (read in the device's day) or a bare date (taken as it is).
const dayOf = at => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(at))) return String(at)
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return String(at || '').slice(0, 10)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

/** The together moments of `group` for the viewer's workout on `day`, shown or left out: `[{ gid, mid, names }]`. */
export function togetherOf(group, day) {
  const me = (group?.members || []).find(m => m.you)
  if (!me || !day) return []
  const nameOf = uid => (group.members || []).find(m => m.uid === uid)?.name
  const shown = (group.moments || []).filter(m => m.kind === 'together')
  return [...shown, ...(group.togetherOff || [])]
    .filter(m => (m.who || []).includes(me.uid) && dayOf(m.at) === day)
    .map(m => ({
      gid: group.id, mid: m.id,
      names: (m.who || []).filter(uid => uid !== me.uid).map(nameOf).filter(Boolean),
    }))
}

/** `[{ gid, mid, names }]` for workout `w` across `groups` (GroupSummary[]), or `[]` while there is none. */
export function useTogether(groups, w, active) {
  const [found, setFound] = useState([])
  const key = (groups || []).map(g => g.id).join(',')
  const day = w ? workoutDay(w) : null
  useEffect(() => {
    if (!active || !day) { setFound([]); return undefined }
    if (mock) { setFound(mock); return undefined }
    if (!friendsAvailable() || !key) { setFound([]); return undefined }
    let live = true
    Promise.all(key.split(',').map(id => getGroup(id).then(g => togetherOf(g, day), () => [])))
      .then(lists => { if (live) setFound(lists.flat()) })
    return () => { live = false }
  }, [active, key, day])
  return found
}
