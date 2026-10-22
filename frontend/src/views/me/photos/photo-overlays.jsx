import Icon from '../../../components/Icon.jsx'
import { MediaView } from '../../../components/CustomMedia.jsx'
import { fmtDate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { useUI } from '../../../store/useUI.js'

// The two overlays over the Photos tab: the seams photos-M3 fills in (the names and arguments stay).
// For now a full sheet showing the photo through MediaView.
// replaced by photos-M3

function Viewer({ photo, close }) {
  return (
    <div className="mviewer" role="dialog" aria-modal="true" aria-label={t('Photo')}>
      <div className="mviewer-bar">
        <button type="button" className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button>
        <span className="mviewer-count">{fmtDate(photo.d, true, true)}</span>
        <span className="ph-bar-gap" />
      </div>
      <div className="mviewer-stage"><MediaView m={photo.ref} cls="exmedia viewer" /></div>
    </div>
  )
}

function Compare({ before, after, close }) {
  return (
    <div className="mviewer" role="dialog" aria-modal="true" aria-label={t('Compare photos')}>
      <div className="mviewer-bar">
        <button type="button" className="iconbtn" aria-label={t('Close')} onClick={close}><Icon name="xmark" /></button>
        <span className="mviewer-count">{fmtDate(before.d, true) + ' · ' + fmtDate(after.d, true)}</span>
        <span className="ph-bar-gap" />
      </div>
      <div className="mviewer-stage ph-pair">
        <MediaView m={before.ref} cls="exmedia viewer" />
        <MediaView m={after.ref} cls="exmedia viewer" />
      </div>
    </div>
  )
}

/** Opens one photo (an allPhotos entry) full screen. */
export function openViewer(photo) {
  useUI.getState().openSheet(close => <Viewer photo={photo} close={close} />, { kind: 'viewer' })
}

/** Opens Compare on `photos` (allPhotos entries, newest first): for now the earliest and the latest. */
export function openCompare(photos) {
  if (!Array.isArray(photos) || photos.length < 2) return
  const after = photos[0], before = photos[photos.length - 1]
  useUI.getState().openSheet(close => <Compare before={before} after={after} close={close} />, { kind: 'viewer' })
}
