import { useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { CATEGORY_COLORS, categoryColor, dotOf } from '../../../lib/nutrition/category-colors.js'
import {
  addCategory, categoryLabel, categoryName, removeCategory, restoreCategory, updateCategory,
  CATEGORY_LABEL_MAX, CATEGORY_NAME_MAX,
} from '../../../lib/nutrition/settings-lists.js'
import { settingOf, useNtSettings, useSheetSave } from '../../../lib/nutrition/use-nt-settings.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import TextField from '../../../ds/TextField.jsx'
import { toastUndoRemove } from './list-undo.js'

const COLOR_NAME = {
  red: () => t('Red'), orange: () => t('Orange'), yellow: () => t('Yellow'), green: () => t('Green'),
  blue: () => t('Blue'), purple: () => t('Purple'), brown: () => t('Brown'), black: () => t('Black'),
}

export const categoryErrorText = code => ({
  name: t('Give the category a name of up to {0} characters.', CATEGORY_NAME_MAX),
  label: t('The label can be up to {0} characters.', CATEGORY_LABEL_MAX),
  duplicate: t('You already have a category with that name.'),
  full: t('That is the most categories there can be. Remove one first.'),
  missing: t('That category is already gone.'),
})[code]

// The colour a new category starts with: the first one no category wears yet, so adding several in a
// row gives different dots without a decision.
const firstFree = categories => {
  const used = new Set(categories.map(categoryColor))
  return (CATEGORY_COLORS.find(c => !used.has(c.id)) || CATEGORY_COLORS[0]).id
}

/**
 * Category drawer (boards St1Category, A1.25): a name and one of eight colours. With `category` it
 * edits that one and offers Delete, which closes with an Undo toast rather than a confirm. A name
 * that foods are filed under is read-only: a food keeps the text of its category, so a rename would
 * leave those foods under a name that is no longer on the list.
 */
export function CategorySheet({ category = null, foodCount = null, close }) {
  const { data } = useNtSettings()
  const categories = settingOf(data, 'foodCategories')
  const editing = category != null
  const original = editing ? categoryName(category) : ''
  const [name, setName] = useState(original)
  const [colour, setColour] = useState(() => (editing ? categoryColor(category) : firstFree(categories)))
  const [picked, setPicked] = useState(false)
  const index = categories.findIndex(c => categoryName(c) === original)
  const entry = categories[index]
  const save = useSheetSave(close)
  // The Undo toast comes only once the delete is saved: a refused one keeps the drawer and says why.
  const del = useSheetSave(() => {
    close()
    if (entry == null) return
    toastUndoRemove({
      message: t('Deleted {0}', original),
      key: 'foodCategories',
      restore: d => restoreCategory(settingOf(d, 'foodCategories'), entry, index),
      errorText: categoryErrorText,
    })
  })
  // `foodCount` null is "not loaded yet": the name stays put until it is known.
  const locked = editing && foodCount !== 0
  const busy = save.busy || del.busy
  const error = save.error || del.error

  // An emoji from before the dots stays as it is until a colour is chosen.
  const labelToStore = editing && !picked && categoryLabel(category) ? categoryLabel(category) : dotOf(colour)
  const submit = e => {
    e.preventDefault()
    save.submit('foodCategories', d => (editing
      ? updateCategory(settingOf(d, 'foodCategories'), original, { name: locked ? original : name, label: labelToStore })
      : addCategory(settingOf(d, 'foodCategories'), { name, label: labelToStore })), categoryErrorText)
  }
  const remove = () => del.submit('foodCategories', d => ({ list: removeCategory(settingOf(d, 'foodCategories'), original) }), categoryErrorText)

  return (
    <BottomSheet title={t('Category')}>
      <form className="set-form" onSubmit={submit}>
        <TextField label={t('Name')} value={name} onChange={setName} wide
          hint={locked ? t('Foods are filed under this name, so it stays as it is.') : undefined}
          inputProps={{ maxLength: CATEGORY_NAME_MAX, disabled: locked, autoFocus: !editing, autoComplete: 'off' }} />
        <div role="radiogroup" aria-label={t('Colour')} className="set-swatches">
          {CATEGORY_COLORS.map(c => (
            <button key={c.id} type="button" role="radio" aria-checked={colour === c.id} aria-label={COLOR_NAME[c.id]()}
              tabIndex={colour === c.id ? 0 : -1} className="set-swatch" onClick={() => { setColour(c.id); setPicked(true) }}>
              <span className={'set-dot set-dot-' + c.id} />
            </button>
          ))}
        </div>
        {error && <p className="set-err" role="alert">{error}</p>}
        <Button type="submit" variant="primary" block busy={save.busy} disabled={busy} haptic>{t('Save category')}</Button>
        {editing && <Button variant="danger" block disabled={busy} onClick={remove}>{t('Delete category')}</Button>}
      </form>
    </BottomSheet>
  )
}

/** Opens the drawer to add a category, or to edit `category` (an entry of the list, with how many foods use it, null while unknown). */
export const openCategorySheet = (category = null, foodCount = null) =>
  useUI.getState().openSheet(close => <CategorySheet category={category} foodCount={foodCount} close={close} />, { variant: 'ds' })
