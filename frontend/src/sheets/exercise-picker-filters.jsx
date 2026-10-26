import { useStore } from '../store/useStore.js'
import { BODYPARTS } from '../lib/exercises.js'
import { exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { SAME, activeFilterCount, pickerContext, pickerList, usePickerView } from '../lib/picker-view.js'
import Icon from '../components/Icon.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'

// The picker's Filters, a sub-panel of the same drawer (the app never opens a drawer on a drawer).
// It edits the picker's view store, so the list behind it is already narrowed when Done slides it out.
export default function PickerFilters({ store, like, close }) {
  const st = useStore(s => s.S)
  const view = usePickerView(store)
  const ctx = pickerContext(st, like)
  const { list, catOpts, catOn, eqOpts, eqOn, bp } = pickerList(st, view, ctx)
  const active = activeFilterCount({ bp, catOn, eqOn })
  const sameLabel = ctx.likeTg && <><Icon name="figureStrength" className="g-icon g-pk-cicon" />{t('Same muscle: {0}', t(MUSCLE_NAME[ctx.likeTg] || ctx.likeTg))}</>
  const reset = () => store.set({ bp: '', cat: '', eq: '' })

  return <BottomSheet type="full" title={t('Filters')}
    footer={<div className="g-pk-foot">
      <Button variant="secondary" disabled={active === 0} onClick={reset}>{t('Reset')}</Button>
      <Button onClick={close}>{t('Show {0}', exCount(list.length))}</Button>
    </div>}>
    {view.tab !== 'muscle' && <section className="g-pk-fgroup">
      <p className="g-pk-head">{t('Body part')}</p>
      <ChipGroup label={t('Body part')} value={bp} onChange={v => store.set({ bp: v })} options={[
        ...(view.tab === 'all' && ctx.likeTg ? [{ value: SAME, label: sameLabel }] : []),
        { value: '', label: t('All') },
        ...BODYPARTS.map(b => ({ value: b, label: t(b) })),
      ]} />
    </section>}
    {catOpts.length > 1 && <section className="g-pk-fgroup">
      <p className="g-pk-head">{t('Type')}</p>
      <ChipGroup label={t('Type')} value={catOn} onChange={v => store.set({ cat: v })}
        options={[{ value: '', label: t('Any type') }, ...catOpts.map(x => ({ value: x, label: t(x) }))]} />
    </section>}
    {eqOpts.length > 1 && <section className="g-pk-fgroup">
      <p className="g-pk-head">{t('Equipment')}</p>
      <ChipGroup label={t('Equipment')} value={eqOn} onChange={v => store.set({ eq: v })}
        options={[{ value: '', label: t('Any equipment') }, ...eqOpts.map(x => ({ value: x, label: t(x) }))]} />
    </section>}
  </BottomSheet>
}
