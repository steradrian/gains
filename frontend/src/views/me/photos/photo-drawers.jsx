import { useRef, useState } from 'react'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import { useMediaPicker } from '../../../components/CustomMediaField.jsx'
import { fmtDate, todayISO } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { addPhoto } from '../../../lib/me/photos.js'
import { syncMedia } from '../../../lib/media-sync.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'

// Board Me2AddPhoto: the Add photo drawer over the Photos tab. The day chip is Today and opens the
// phone's date picker for a past day (never a day to come); Take a photo and Choose from library
// run the file through the same ingest every photo in the app takes (useMediaPicker) and save it as
// a progress photo of that day (lib/me/photos.js addPhoto). The picture is no longer attached to a
// workout: its home is S.bodyPhotos.
function AddPhoto({ close }) {
  const update = useStore(s => s.update)
  const today = todayISO()
  const [day, setDay] = useState(today)
  const { pick, busy, canAdd, showAdd, note } = useMediaPicker()
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)
  const dateRef = useRef(null)
  const toast = (msg) => useUI.getState().toast(msg)

  const openDate = () => {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.click()
  }
  const open = ref => { if (canAdd) ref.current?.click() }

  const onFile = async ev => {
    const file = ev.target.files && ev.target.files[0]
    ev.target.value = ''   // picking the same file again still fires onChange
    if (!file) return
    const got = await pick(file)
    if (!got) return
    let res
    update(s => { res = addPhoto(s, { d: day, ref: got }) })
    if (res === 'added') {
      close()
      toast(t('Photo added'))
      syncMedia({ force: true })
    } else if (res === 'dup') toast(t('That photo is already on this day.'))
    else toast(t('Choose a still photo.'))
  }

  return (
    <BottomSheet title={t('Add photo')} chip={day === today ? t('Today') : fmtDate(day, true)} onChip={openDate} chipLabel={t('Change day')}>
      <input ref={dateRef} className="ph-date" type="date" value={day} max={today} tabIndex={-1} aria-hidden="true"
        onChange={e => { if (e.target.value && e.target.value <= today) setDay(e.target.value) }} />
      {showAdd && (
        <>
          <DetailRow icon="camera" title={t('Take a photo')} sub={busy ? t('Loading…') : undefined} onClick={() => open(cameraRef)} />
          <DetailRow icon="image" title={t('Choose from library')} onClick={() => open(libraryRef)} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          <input ref={libraryRef} type="file" accept="image/*" hidden onChange={onFile} />
        </>
      )}
      {note && <p className="ph-hint">{note}</p>}
      <p className="ph-hint">{t('Same light, same spot, same pose makes Compare honest. Only you see photos.')}</p>
    </BottomSheet>
  )
}

/** Board Me2AddPhoto: opens the Add photo drawer. The Photo quick action and the Photos tab call it. */
export const openAddPhoto = () =>
  useUI.getState().openSheet(close => <AddPhoto close={close} />, { variant: 'ds' })
