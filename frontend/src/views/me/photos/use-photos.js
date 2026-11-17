import { useMemo } from 'react'
import { t, tn } from '../../../lib/i18n.js'
import { localOnlyCount, setPhotoBackup } from '../../../lib/me/photos.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { photosOf, photosSub } from './photos-data.js'

/** The Photos tab's data and the one write it makes (Back up photos). */
export function usePhotos() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const data = useMemo(() => photosOf(S), [S])

  // Turning it on says how many photos start to go up (those held on this phone), with Undo for 8 s;
  // with none held there is nothing to say about uploading. Turning it off needs no toast.
  const setBackup = on => {
    const held = localOnlyCount(useStore.getState().S)
    update(s => setPhotoBackup(s, on))
    if (!on || held === 0) return
    useUI.getState().toast(tn('Backing up {0} photo to your account', 'Backing up {0} photos to your account', held), {
      action: t('Undo'),
      onAction: () => update(s => setPhotoBackup(s, false)),
    })
  }

  return { data, unit: S.unit, setBackup }
}

/** The Body page's line under the title while the Photos tab is open. */
export function usePhotosSub(active) {
  const S = useStore(s => s.S)
  return useMemo(() => (active ? photosSub(photosOf(S)) : undefined), [S, active])
}
