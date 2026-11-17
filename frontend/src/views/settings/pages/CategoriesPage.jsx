import { useEffect } from 'react'
import { t, tn } from '../../../lib/i18n.js'
import { categoryColor } from '../../../lib/nutrition/category-colors.js'
import { categoryName } from '../../../lib/nutrition/settings-lists.js'
import { useNutrition } from '../../../lib/nutrition/store.js'
import { settingOf, useNtSettings } from '../../../lib/nutrition/use-nt-settings.js'
import NtSettingsGate from '../../../components/NtSettingsGate.jsx'
import StageEmpty from '../../../ds/StageEmpty.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { openCategorySheet } from './category-sheet.jsx'
import { useFreshNtSettings } from './use-fresh-nt-settings.js'

const foodsText = n => tn('{0} food', '{0} foods', n)

/** How many of `foods` are filed under each of the listed categories: { by: { [name]: n }, total }. */
export function tallyCategories(categories, foods) {
  const names = new Set(categories.map(categoryName))
  const by = {}
  let total = 0
  for (const f of foods) {
    if (!f.category || !names.has(f.category)) continue
    by[f.category] = (by[f.category] || 0) + 1
    total += 1
  }
  return { by, total }
}

// Categories (boards St1Categories, A1.24): the tags a food can be filed under, each a name with a
// colour dot, and how many foods wear it. A row opens the category drawer (A1.25). The list is the
// hub's `foodCategories`, written whole, one write per change (lib/nutrition/settings-lists.js).
export default function CategoriesPage() {
  const { data } = useNtSettings()
  const foods = useNutrition(s => s.foods)
  useFreshNtSettings()
  useEffect(() => { useNutrition.getState().loadFoods({ force: true }) }, [])

  const categories = data ? settingOf(data, 'foodCategories') : []
  // Counts are drawn only once the foods are here: a "0 foods" while they load would be a claim.
  const counted = foods.status === 'ready' ? tallyCategories(categories, foods.list) : null
  const line = categories.length
    ? [tn('{0} category', '{0} categories', categories.length), counted && tn('used by {0} food', 'used by {0} foods', counted.total)].filter(Boolean).join(' · ')
    : undefined

  return (
    <SettingsPage title={t('Categories')} line={line}>
      <div className="set-body">
        {!data ? <NtSettingsGate>{null}</NtSettingsGate> : <>
          {categories.length === 0 && (
            <StageEmpty illustration="plate" card={false} title={t('No categories yet')} body={t('Foods can be filed under them from the food editor.')} />
          )}
          <div className="g-glist g-glass">
            {categories.map(c => (
              <SettingRow key={categoryName(c)} title={categoryName(c)} sub={counted ? foodsText(counted.by[categoryName(c)] || 0) : undefined}
                lead={<span className={'set-dot set-dot-' + categoryColor(c)} aria-hidden="true" />}
                onClick={() => openCategorySheet(c, counted ? counted.by[categoryName(c)] || 0 : null)} />
            ))}
            <SettingRow icon="plusCircle" title={t('Add a category')} onClick={() => openCategorySheet()} />
          </div>
          {categories.length > 0 && <StageNote>{t('A food is filed under one from the food editor. Its category shows beside it in My foods when Show categories is on.')}</StageNote>}
        </>}
      </div>
    </SettingsPage>
  )
}
