import { useState } from 'react'
import Button from '../../../ds/Button.jsx'
import CompareView from '../../../ds/CompareView.jsx'
import PhotoGrid from '../../../ds/PhotoGrid.jsx'
import PhotoStage from '../../../ds/PhotoStage.jsx'
import { fmtDate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import PhotoPicture from './PhotoPicture.jsx'
import PhotoThumb from './PhotoThumb.jsx'
import { compareFacts, compareLine, orderPair } from './photo-compare.js'
import { tileText } from './photos-data.js'

/**
 * Compare (board Me2Compare): two of `photos` side by side, the earlier one first, with each day and
 * weight and the change between them. "Change before" / "Change after" open a picker of the other
 * photos inside the overlay (a panel of its own, never a second drawer) and the pair is put back in
 * date order. `pair` is the starting [before, after].
 */
export default function CompareScreen({ photos, pair, close }) {
  const S = useStore(s => s.S)
  const unit = S.unit || 'kg'
  const [[before, after], setPair] = useState(pair)
  const [picking, setPicking] = useState(null)   // 'before' | 'after' while the picker is open

  const side = (photo, which) => {
    const { date, weight, label } = tileText(photo, unit)
    return {
      image: <PhotoPicture photo={photo} alt={label} />, date, caption: weight,
      changeLabel: which === 'before' ? t('Change before') : t('Change after'),
      onChange: () => setPicking(which),
    }
  }

  if (picking) {
    const other = picking === 'before' ? after : before
    const choose = photo => { setPair(orderPair(photo, other)); setPicking(null) }
    return (
      <PhotoStage label={t('Compare photos')} title={picking === 'before' ? t('Choose the before photo') : t('Choose the after photo')}
        closeLabel={t('Close')} onClose={close}
        actions={<Button variant="glass" icon="chevronLeft" onClick={() => setPicking(null)}>{t('Back')}</Button>}>
        <div className="ph-pick">
          <PhotoGrid label={t('Photos')}>
            {photos.filter(p => p.key !== other.key).map(p => <PhotoThumb key={p.key} photo={p} unit={unit} onOpen={choose} />)}
          </PhotoGrid>
        </div>
      </PhotoStage>
    )
  }

  return (
    <PhotoStage label={t('Compare photos')} title={t('Compare')} count={fmtDate(before.d, true) + ' · ' + fmtDate(after.d, true)}
      closeLabel={t('Close')} onClose={close}>
      <CompareView before={side(before, 'before')} after={side(after, 'after')} line={compareLine(compareFacts(S, before, after))} />
    </PhotoStage>
  )
}
