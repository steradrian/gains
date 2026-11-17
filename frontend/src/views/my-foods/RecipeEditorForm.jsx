import { t } from '../../lib/i18n.js'
import { nutritionOf } from '../../lib/nutrition/diary.js'
import { RECIPES_LIST } from '../../lib/nutrition/editor-routes.js'
import { fmtAmount, nutrientLabel } from '../../lib/nutrition/foods.js'
import { amountOf, gramsOfAll } from '../../lib/nutrition/meals.js'
import { servingOf } from '../../lib/nutrition/recipe-form.js'
import { ingredientDrawer } from '../../components/IngredientDrawer.jsx'
import Button from '../../ds/Button.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import SavedIndicator from '../../ds/SavedIndicator.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import TextField from '../../ds/TextField.jsx'
import { kcalText } from './library-text.js'
import RecipePhotoField from './RecipePhotoField.jsx'
import RecipeStepList from './RecipeStepList.jsx'
import { useRecipeEditor } from './use-recipe-editor.js'

const MACROS = ['proteins', 'carbohydrates', 'fat']

// The recipe editor (boards Ea5Recipe, Ea5RecipeDeleted), pushed under My foods: a photo, a name,
// how many servings it makes and what one is, the ingredients, the steps, and each serving's
// numbers. Saves as you type; Back keeps what was typed. Add ingredient and an ingredient's row
// open the ingredient drawer over the page.
export default function RecipeEditorForm({ recipe, prefill, settings }) {
  const editor = useRecipeEditor({ recipe, prefill })
  const { form, rev, change, perServing, recordId } = editor
  const isNew = !recipe
  const empty = form.items.length === 0
  const one = servingOf(form)

  const drawer = (item = null, index = null) => ingredientDrawer({
    item, index, onAdd: editor.addIngredient, onChange: editor.changeIngredient, onRemove: editor.takeOut,
  })

  const makesHint = form.amountTyped
    ? t('Makes is the weight you typed. Clear it and it follows the ingredients again.')
    : t('Makes follows the ingredients, {0}, until you type the cooked weight. Servings and one serving keep each other in step.', `${fmtAmount(gramsOfAll(form.items))} ${form.unit}`)

  return (
    <StagePage title={isNew && !recordId ? t('New recipe') : t('Recipe')} parent={RECIPES_LIST}>
      <div className="g-fe">
        {/* Saving is silent; the indicator is only here when it failed, as the button that retries. */}
        {editor.state === 'error' && (
          <div className="g-fe-saved">
            <SavedIndicator tone="stage" state="error" onClick={editor.retry} />
          </div>
        )}

        <RecipePhotoField photo={form.photo} onChange={editor.setPhoto} />

        <div className="g-fe-fields">
          <TextField tone="stage" wide label={t('Name')} value={form.name} onChange={v => change({ name: v })}
            inputProps={{ maxLength: 120, autoFocus: isNew && !prefill?.name }} />
        </div>
        <div className="g-fe-grid">
          <TextField key={'servings-' + rev.servings} tone="stage" wide label={t('Servings')} inputMode="numeric" value={form.servings}
            onChange={v => change({ servings: v })} inputProps={{ maxLength: 3 }} />
          <TextField key={'serving-' + rev.serving} tone="stage" wide label={t('One serving')} unit={form.unit} inputMode="decimal" value={form.serving}
            onChange={v => change({ serving: v })} />
        </div>
        <div className="g-fe-fields">
          <TextField key={'amount-' + rev.amount} tone="stage" wide label={t('Makes')} unit={form.unit} inputMode="decimal" value={form.amount}
            hint={makesHint} onChange={v => change({ amount: v })} />
        </div>

        <StageSection title={t('Ingredients')} />
        {empty
          ? <StageEmpty illustration="plate" card={false} title={t('No ingredients yet')} body={t('Add what goes in it and Gains works out each serving.')}
            action={t('Add ingredient')} onClick={() => drawer()} />
          : (
            <>
              <div className="g-glist g-glass g-fe-list">
                {form.items.map((item, i) => (
                  <GlassValueRow key={i} title={item.name} sub={amountOf(item)}
                    value={kcalText(nutritionOf(item).calories || 0, settings)}
                    onClick={() => drawer(item, i)} />
                ))}
              </div>
              <Button variant="glass" icon="plus" className="g-rec-add" onClick={() => drawer()}>{t('Add ingredient')}</Button>
            </>
          )}
        {editor.problem && <p className="g-fe-problem" role="alert">{editor.problem}</p>}

        <StageSection title={t('Steps')} />
        {form.steps.length > 0 && (
          <>
            <RecipeStepList identity={recordId ?? 'new'} steps={form.steps} focusId={editor.focusStep} onEdit={editor.editStep}
              onRemove={editor.removeStep} onMove={editor.moveStep} onShift={editor.shiftStep} />
            <StageNote>{t('Hold and drag to reorder. Steps show when you log or cook it.')}</StageNote>
          </>
        )}
        <Button variant="glass" icon="plus" className="g-rec-add" onClick={editor.addStep}>{t('Add step')}</Button>

        <StageSection title={one != null ? t('Per serving, {0}', `${fmtAmount(one)} ${form.unit}`) : t('Per serving')} />
        {perServing
          ? (
            <>
              <div className="g-glist g-glass g-fe-list">
                <GlassValueRow static title={nutrientLabel('calories')} value={kcalText(Math.round(perServing.calories || 0), settings)} />
                {MACROS.map(id => (
                  <GlassValueRow static key={id} title={nutrientLabel(id)} value={t('{0} g', fmtAmount(perServing[id] || 0))} />
                ))}
              </div>
              <StageNote>{t('Change what it makes after cooking and every serving updates.')}</StageNote>
            </>
          )
          : <StageNote>{t('Set how many servings it makes to see each one.')}</StageNote>}

        {recordId && (
          <>
            <Button variant="glass" block icon="trash" haptic className="g-fe-delete" onClick={editor.remove}>{t('Delete recipe')}</Button>
            <StageNote>{t('Deleting keeps every entry you already logged with it. Undo for 8 s.')}</StageNote>
          </>
        )}
      </div>
    </StagePage>
  )
}
