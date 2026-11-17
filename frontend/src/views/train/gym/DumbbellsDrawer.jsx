import { useRef } from 'react'
import { cleanWeights, dumbbellsOf, presetWeights, withDumbbells } from '../../../lib/dumbbells.js'
import { fmtPlate } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import IconButton from '../../../ds/IconButton.jsx'
import TextField from '../../../ds/TextField.jsx'
import '../coach-pages.css'

// The dumbbells you own, for the profile's unit (T12.0's Dumbbells; it replaces the old inventory
// sheet; issue #376): a list of single bells, kept per unit like the plates (lib/dumbbells.js).
// With one, progression, deloads, warm-ups, drops and the stepper of every dumbbell lift land on
// these; an empty list puts them back on the increment. A row's × takes a weight off, the field
// adds one, and the fill writes the usual rack for the unit to edit from. One list for every
// profile, and every change is stamped.
export default function DumbbellsDrawer({ close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const field = useRef(null)
  const unit = st.unit === 'lb' ? 'lb' : 'kg'
  const list = dumbbellsOf(st)
  const preset = presetWeights(unit)
  const save = ws => update(s => { s.dumbbells = withDumbbells(s, ws) })
  const add = () => {
    // A comma is a decimal point in most languages
    const w = cleanWeights([String(field.current?.value ?? '').replace(',', '.')])[0]
    if (!w) { useUI.getState().toast(t('Enter a valid weight')); return }
    save([...list, w])
    field.current.value = ''
  }
  return (
    <BottomSheet type="full" title={t('Dumbbells')} footer={<Button block onClick={close}>{t('Done')}</Button>}>
      <p className="tcp-dnote">{t('The weights you own, one bell each. Progression, deloads, warm-ups and the + and − buttons of dumbbell lifts land only on these.')}</p>
      {list.length > 0
        ? <div>{list.map(w => {
          const text = fmtPlate(w) + ' ' + unit
          return <DetailRow key={w} title={text} trailing={<IconButton icon="xmark" label={t('Remove {0}', text)} onClick={() => save(list.filter(x => x !== w))} />} />
        })}</div>
        : <p className="tcp-dnote">{t('No list yet, so dumbbell lifts step by their increment as usual.')}</p>}
      <div className="tcp-add">
        <TextField label={t('Weight ({0})', unit)} inputMode="decimal" inputRef={field}
          inputProps={{ onKeyDown: e => { if (e.key === 'Enter') add() } }} />
        <Button variant="secondary" icon="plus" onClick={add}>{t('Add')}</Button>
      </div>
      <Button variant="secondary" block onClick={() => save(preset)}>
        {t('Fill in {0} to {1} {2}, every {3}', fmtPlate(preset[0]), fmtPlate(preset.at(-1)), unit, fmtPlate(preset[1] - preset[0]))}
      </Button>
      {list.length > 0 && <Button variant="danger" block onClick={() => save([])}>{t('Clear the list')}</Button>}
    </BottomSheet>
  )
}
