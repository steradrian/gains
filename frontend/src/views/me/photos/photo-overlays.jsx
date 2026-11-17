import { allPhotos } from '../../../lib/me/photos.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import CompareScreen from './CompareScreen.jsx'
import PhotoViewer from './PhotoViewer.jsx'
import { PhotoSourceContext } from './PhotoThumb.jsx'
import { defaultPair, pairFor } from './photo-compare.js'

// The two full-screen overlays over the Photos tab (boards Me2Viewer and Me2Compare), opened as
// `viewer` sheets. `source` is the gallery's way to supply pictures (dev/screens); the app leaves it out.
const withSource = (source, node) => (source ? <PhotoSourceContext.Provider value={source}>{node}</PhotoSourceContext.Provider> : node)

/** Opens Compare on `photos` (allPhotos entries, newest first): `pair` or, by default, the oldest and the newest. */
export function openCompare(photos, { pair, source } = {}) {
  const start = pair || defaultPair(photos)
  if (!start) return
  useUI.getState().openSheet(close => withSource(source, <CompareScreen photos={photos} pair={start} close={close} />), { kind: 'viewer' })
}

/** Opens one photo (an allPhotos entry) full screen, with the others to swipe to. */
export function openViewer(photo, { photos = allPhotos(useStore.getState().S), source } = {}) {
  const found = photos.findIndex(p => p.key === photo.key)
  const list = found < 0 ? [photo] : photos
  const onCompare = current => {
    const pair = pairFor(list, current)
    if (pair) openCompare(list, { pair, source })
  }
  useUI.getState().openSheet(close => withSource(source, <PhotoViewer photos={list} start={Math.max(0, found)} onCompare={onCompare} close={close} />), { kind: 'viewer' })
}
