import { t } from '../../lib/i18n.js'
import { nutritionOf } from '../../lib/nutrition/diary.js'
import { MEALS_LIST } from '../../lib/nutrition/editor-routes.js'
import { dayName } from '../../lib/nutrition/log-feedback.js'
import { amountOf } from '../../lib/nutrition/meals.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { switchTab } from '../../lib/use-tab-nav.js'
import { ingredientDrawer } from '../../components/IngredientDrawer.jsx'
import { useLibraryLog } from '../../components/use-library-log.js'
import Button from '../../ds/Button.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import SavedIndicator from '../../ds/SavedIndicator.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import TextField from '../../ds/TextField.jsx'
import { macroRows, shareLine } from './meal-share.js'
import { kcalText } from './library-text.js'
import { useMealEditor, useTodayTargets } from './use-meal-editor.js'

// The saved meal editor (boards Ea5Meal, Ea5MealDeleted), pushed under My foods: a name, the foods
// with their amounts, the total against today's targets, and Log to Today. Saves as you type; Back
// keeps what was typed. Add food and a food's amount open the ingredient drawer over the page.
export default function MealEditorForm({ meal, prefill, settings }) {
  const editor = useMealEditor({ meal, prefill })
  const { form, total, recordId } = editor
  const record = useNutrition(s => s.meals.list.find(m => m.id === recordId)) || null
  const targets = useTodayTargets(settings)
  const log = useLibraryLog(record, { today: true })
  const isNew = !meal
  const rows = macroRows(total, targets)
  const share = shareLine(rows)
  const empty = form.items.length === 0
  const drawer = (item = null, index = null) => ingredientDrawer({
    item, index, onAdd: editor.addFood, onChange: editor.changeFood, onRemove: editor.removeFood,
  })

  async function logIt() {
    await editor.flush()
    if (await log.log()) switchTab('home')
  }

  return (
    <StagePage title={t('Saved meal')} parent={MEALS_LIST}>
      <div className="g-fe">
        <div className="g-fe-saved">
          <SavedIndicator tone="stage" state={editor.state} onClick={editor.state === 'error' ? editor.retry : undefined} />
          <span>{t('Changes save as you type.')}</span>
        </div>

        <div className="g-fe-fields">
          <TextField tone="stage" wide label={t('Name')} value={form.name} onChange={v => editor.change({ name: v })}
            inputProps={{ maxLength: 120, autoFocus: isNew && !prefill?.name }} />
        </div>

        <StageSection title={t('Foods')} action={t('Add food')} onAction={() => drawer()} />
        {empty
          ? <StageEmpty illustration="plate" card={false} title={t('No foods in this meal yet')} body={t('Add the foods you eat together.')}
            action={t('Add food')} onClick={() => drawer()} />
          : (
            <div className="g-glist g-glass g-fe-list">
              {form.items.map((item, i) => (
                <GlassValueRow key={i} title={item.name} sub={amountOf(item)}
                  value={kcalText(nutritionOf(item).calories || 0, settings)}
                  onClick={() => drawer(item, i)} />
              ))}
            </div>
          )}
        {editor.problem && <p className="g-fe-problem" role="alert">{editor.problem}</p>}

        {!empty && (
          <>
            <StageSection title={t('Total, {0}', kcalText(Math.round(total.calories || 0), settings))} />
            <div className="g-glist g-glass g-fe-list">
              {rows.map(r => (
                <GlassValueRow static key={r.id} title={r.label}
                  value={r.target ? t('{0} of {1} g', r.grams, r.target) : t('{0} g', r.grams)} />
              ))}
            </div>
            {share && <StageNote>{share}</StageNote>}
          </>
        )}

        <div className="g-fe-fields">
          <TextField tone="stage" wide multiline label={t('Notes')} value={form.notes} onChange={v => editor.change({ notes: v })} inputProps={{ maxLength: 500 }} />
        </div>

        {recordId && (
          <>
            <Button block haptic busy={log.busy} disabled={empty} onClick={logIt}>
              {t('Log to {0}, {1}', dayName(log.target.date), log.target.mealName)}
            </Button>
            <Button variant="glass" block icon="trash" className="g-fe-delete" onClick={editor.remove}>{t('Delete saved meal')}</Button>
          </>
        )}
      </div>
    </StagePage>
  )
}
