import { useId } from 'react'
import Button from '../../../ds/Button.jsx'
import GlassRow from '../../../ds/GlassRow.jsx'
import PhotoGrid from '../../../ds/PhotoGrid.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import { fmtNum } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { openAddPhoto } from './photo-drawers.jsx'
import { openCompare, openViewer } from './photo-overlays.jsx'
import PhotoThumb from './PhotoThumb.jsx'
import { backupSub, photosFooter } from './photos-data.js'
import { usePhotos } from './use-photos.js'
import './photos.css'

// The Photos tab of the Body page (boards Me2Photos, Me2PhotosEmpty, Me2PhotosSync): Add photo and
// Compare, the Back up photos row, the grid newest first with each day's weight, and where they
// are kept. It draws what photosOf (photos-data.js) gives it; the drawers and overlays are opened
// from photo-drawers.jsx and photo-overlays.jsx.
export default function PhotosTab() {
  const { data, unit, setBackup } = usePhotos()
  const hintId = useId()

  if (data.empty) {
    return (
      <StageEmpty illustration="calendar" card={false} title={t('No photos yet')}
        body={t('Take one every two weeks, same light and pose. Compare lines up any two by date. They stay on this phone unless you turn on backup.')}
        action={t('Add photo')} onClick={openAddPhoto} />
    )
  }

  const one = data.count === 1
  return (
    <div className="ph">
      <div className="ph-acts">
        <Button variant="glass" icon="camera" onClick={openAddPhoto}>{t('Add photo')}</Button>
        <Button variant="glass" icon="sides" disabled={!data.canCompare} aria-describedby={one ? hintId : undefined}
          onClick={() => openCompare(data.photos)}>{t('Compare')}</Button>
      </div>
      {one && <p className="ph-line" id={hintId}>{t('Add one more photo to compare.')}</p>}
      <GlassRow title={t('Back up photos')} sub={backupSub(data.backupOn)}
        trailing={<StageSwitch checked={data.backupOn} onChange={setBackup} label={t('Back up photos')} />} />
      <StageSection title={data.header === 'phone' ? t('On this phone') : t('In your account')} action={fmtNum(data.count)} />
      <PhotoGrid label={data.header === 'phone' ? t('On this phone') : t('In your account')}>
        {data.photos.map(p => <PhotoThumb key={p.key} photo={p} unit={unit} onOpen={openViewer} />)}
      </PhotoGrid>
      <StageNote>{photosFooter(data)}</StageNote>
    </div>
  )
}
