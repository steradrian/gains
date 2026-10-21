import { fmtPlate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { PLATE_SIZES, ownsPlates, pairsOf, withPlatePairs, withStandardPlates } from '../../../lib/plates.js'
import { useStore } from '../../../store/useStore.js'
import BigStepper from '../../../ds/BigStepper.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import '../coach-pages.css'

// The plates you own, as pairs per size, for the profile's unit (T12.0's Plates; it replaces the
// old inventory sheet). The first edit copies the standard set into S.plates[unit] and changes one
// count in it, so the list you see is always the list the set rows load from. "Back to the
// standard set" empties the unit's list again. Both are stamped (lib/plates.js), so the last change
// wins a sync. One list for every profile.
export default function PlatesDrawer({ close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const unit = st.unit === 'lb' ? 'lb' : 'kg'
  const own = ownsPlates(st)
  const setPairs = (w, n) => update(s => { s.plates = withPlatePairs(s, w, n) })
  const reset = () => update(s => { s.plates = withStandardPlates(s) })
  return (
    <BottomSheet type="full" title={t('Plates')}
      footer={<>
        {own && <Button variant="secondary" block onClick={reset}>{t('Back to the standard set')}</Button>}
        <Button block onClick={close}>{t('Done')}</Button>
      </>}>
      <p className="tcp-dnote">{t('Pairs of each size you own. Every set row loads from this list, so a home gym with one pair of 45s is never told to use two.')}</p>
      {PLATE_SIZES[unit].map(w => {
        const size = fmtPlate(w) + ' ' + unit
        return (
          <BigStepper key={w} decimals={0} unit={t('pairs')} value={pairsOf(st, w)}
            label={t('{0} plates', size)} lessLabel={t('Fewer {0} plates', size)} moreLabel={t('More {0} plates', size)}
            onChange={n => setPairs(w, n)} />
        )
      })}
      <p className="tcp-dnote">{own ? t('Your own list for {0}.', unit) : t('The standard set, plenty of each. Change any count to make it yours.')}</p>
    </BottomSheet>
  )
}
