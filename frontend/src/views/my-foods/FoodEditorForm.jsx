import { useState } from 'react'
import { t } from '../../lib/i18n.js'
import { UNITS, customUnitAbbrs } from '../../lib/nutrition/diary.js'
import { NUTRIENTS, categoryChoices, fmtAmount, nutrientLabel } from '../../lib/nutrition/foods.js'
import Button from '../../ds/Button.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import SavedIndicator from '../../ds/SavedIndicator.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import StageSwitch from '../../ds/StageSwitch.jsx'
import TextField from '../../ds/TextField.jsx'
import { FOODS_LIST } from '../../lib/nutrition/editor-routes.js'
import { openCategorySheet } from '../settings/pages/category-sheet.jsx'
import { choiceSheet } from './ChoiceSheet.jsx'
import { useFoodEditor } from './use-food-editor.js'

const MAIN = ['calories', 'proteins', 'carbohydrates', 'fat', 'fiber']
const SHOWN_FIRST = NUTRIENTS.filter(n => MAIN.includes(n.id))
  .sort((a, b) => MAIN.indexOf(a.id) - MAIN.indexOf(b.id))
const MORE = NUTRIENTS.filter(n => !MAIN.includes(n.id))

// The food editor (boards Ea5Food, Ea5Deleted), pushed under My foods. Saves as you type and has
// no Save button; Back keeps what was typed. The text fields keep their own text (the kit's field
// is uncontrolled), the editor keeps the form the saves are made from.
export default function FoodEditorForm({ food, prefill, settings }) {
  const editor = useFoodEditor({ food, prefill, settings })
  const { form, change, setNutrient, energyUnit, problem, recordId, state } = editor
  const [more, setMore] = useState(false)
  const isNew = !food

  const catalogue = [...customUnitAbbrs(settings), ...UNITS]
  const units = form.unit && !catalogue.includes(form.unit) ? [form.unit, ...catalogue] : catalogue
  const choices = categoryChoices(settings)
  const categories = form.category && !choices.includes(form.category) ? [...choices, form.category] : choices

  const pickUnit = () => choiceSheet({
    title: t('Unit name'), value: form.unit, onPick: unit => change({ unit }),
    options: units.map(u => ({ value: u, label: u })),
  })
  const pickCategory = () => choiceSheet({
    title: t('Category'), value: form.category, onPick: category => change({ category }),
    options: [{ value: '', label: t('None') }, ...categories.map(c => ({ value: c, label: c }))],
    footer: { label: t('Add a category'), onClick: close => { close(); openCategorySheet() } },
  })

  const portion = Number(String(form.portion).replace(',', '.'))
  const perServing = portion > 0 ? t('Per serving, {0}', `${fmtAmount(portion)} ${form.unit}`) : t('Per serving')
  const nutrientField = n => (
    <TextField key={n.id} tone="stage" wide label={(n.sub ? '· ' : '') + nutrientLabel(n.id)} inputMode="decimal"
      unit={n.id === 'calories' ? energyUnit : n.unit} value={form.nutrients[n.id]} onChange={v => setNutrient(n.id, v)} />
  )

  return (
    <StagePage title={isNew && !recordId ? t('New food') : t('Edit food')} parent={FOODS_LIST}>
      <div className="g-fe">
        <div className="g-fe-saved">
          <SavedIndicator tone="stage" state={state} onClick={state === 'error' ? editor.retry : undefined} />
          <span>{t('Changes save as you type.')}</span>
        </div>

        <div className="g-fe-fields">
          <TextField tone="stage" wide label={t('Name')} value={form.name} onChange={v => change({ name: v })}
            inputProps={{ maxLength: 120, autoFocus: isNew && !prefill?.name }} />
          <TextField tone="stage" wide label={t('Brand')} value={form.brand} onChange={v => change({ brand: v })} inputProps={{ maxLength: 120 }} />
          <TextField tone="stage" wide label={t('Serving')} unit={form.unit} inputMode="decimal" value={form.portion} onChange={v => change({ portion: v })} />
        </div>
        <div className="g-glist g-glass g-fe-list">
          <GlassValueRow title={t('Unit name')} value={form.unit} onClick={pickUnit} />
        </div>

        <StageSection title={perServing} />
        <div className="g-fe-grid">{SHOWN_FIRST.map(nutrientField)}</div>
        <Button variant="glass" size="sm" className="g-fe-more" aria-expanded={more} onClick={() => setMore(m => !m)}>
          {more ? t('Fewer nutrients') : t('More nutrients')}
        </Button>
        {more && <div className="g-fe-grid">{MORE.map(nutrientField)}</div>}
        {problem && <p className="g-fe-problem" role="alert">{problem}</p>}

        <StageSection title={t('Details')} />
        <div className="g-fe-fields">
          <TextField tone="stage" wide label={t('Barcode')} inputMode="numeric" value={form.barcode} onChange={v => change({ barcode: v })} inputProps={{ maxLength: 32 }} />
        </div>
        <div className="g-glist g-glass g-fe-list">
          <GlassValueRow title={t('Category')} value={form.category || t('None')} onClick={pickCategory}
            trailing={<span className="g-fe-change">{t('Change')}</span>} />
          <GlassValueRow static title={t('Favorite')} sub={t('Shows first in Log food')}
            trailing={<StageSwitch checked={form.favorite} onChange={favorite => change({ favorite })} label={t('Favorite')} />} />
        </div>
        <div className="g-fe-fields">
          <TextField tone="stage" wide multiline label={t('Notes')} value={form.notes} onChange={v => change({ notes: v })} inputProps={{ maxLength: 500 }} />
        </div>

        {recordId && (
          <>
            <Button variant="glass" block icon="trash" className="g-fe-delete" onClick={editor.remove}>{t('Delete food')}</Button>
            <StageNote>{t('Deleting keeps every entry you already logged with it. Undo for 8 s.')}</StageNote>
          </>
        )}
      </div>
    </StagePage>
  )
}
