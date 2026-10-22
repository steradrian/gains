import { useEffect, useRef, useState } from 'react'
import Button from '../../../ds/Button.jsx'
import IconButton from '../../../ds/IconButton.jsx'
import PhotoStage from '../../../ds/PhotoStage.jsx'
import { fmtDate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import PhotoPicture from './PhotoPicture.jsx'
import { tileText } from './photos-data.js'
import { confirmDeletePhoto } from './photo-delete.js'

const SWIPE_PX = 50
const isRtl = () => document.documentElement.dir === 'rtl'

/**
 * The photo viewer (board Me2Viewer): one photo of `photos` (allPhotos entries, newest first) full
 * screen, with its day and that day's weight under it, Compare and Delete. Arrow keys, a swipe or the
 * two edge buttons move between photos; the count ("2 of 6") is announced. Deleting closes the
 * viewer (the photo is gone; the Undo is the toast).
 */
export default function PhotoViewer({ photos, start, onCompare, close }) {
  const [i, setI] = useState(start)
  const unit = useStore(s => s.S.unit) || 'kg'
  const down = useRef(null)
  const photo = photos[i]
  const { weight, label } = tileText(photo, unit)

  const root = useRef(null)
  useEffect(() => { root.current?.focus() }, [])

  const step = n => setI(cur => Math.min(photos.length - 1, Math.max(0, cur + n)))
  // "Previous" sits at the start edge: the newer photo, since the list runs newest first.
  const toward = dx => (isRtl() ? dx > 0 : dx < 0) ? 1 : -1
  const onKeyDown = e => {
    if (e.key === 'ArrowLeft') step(isRtl() ? 1 : -1)
    else if (e.key === 'ArrowRight') step(isRtl() ? -1 : 1)
    else return
    e.preventDefault()
  }
  const onPointerDown = e => { down.current = e.clientX }
  const onPointerUp = e => {
    const from = down.current
    down.current = null
    if (from != null && Math.abs(e.clientX - from) >= SWIPE_PX) step(toward(e.clientX - from))
  }

  const actions = (
    <>
      <Button variant="glass" icon="sides" disabled={photos.length < 2} onClick={() => onCompare(photo)}>{t('Compare')}</Button>
      <Button variant="glass" icon="trash" onClick={() => confirmDeletePhoto(photo, close)}>{t('Delete')}</Button>
    </>
  )
  return (
    <PhotoStage ref={root} tabIndex={-1} onKeyDown={onKeyDown} label={t('Photo')} title={fmtDate(photo.d, true, true)}
      count={t('{0} of {1}', i + 1, photos.length)} closeLabel={t('Close')} onClose={close} actions={actions}>
      <div className="g-pstage-pic" data-swipe-ignore onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { down.current = null }}>
        <PhotoPicture key={photo.key} photo={photo} alt={label} />
        {i > 0 && <IconButton className="g-pstage-nav g-pstage-nav-prev" icon="chevronLeft" tone="glass" label={t('Previous photo')} onClick={() => step(-1)} />}
        {i < photos.length - 1 && <IconButton className="g-pstage-nav g-pstage-nav-next" icon="chevronRight" tone="glass" label={t('Next photo')} onClick={() => step(1)} />}
      </div>
      <div className="g-pstage-cap">
        <b>{fmtDate(photo.d, true)}</b>
        {weight && <span>{t('{0} that day', weight)}</span>}
      </div>
    </PhotoStage>
  )
}
