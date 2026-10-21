import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { MEALS_LIST } from '../../lib/nutrition/editor-routes.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { Loading } from '../../components/Loader.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import MealEditorForm from './MealEditorForm.jsx'

// /food/my-foods/meals/:id, and /food/my-foods/meals/new (the same route, `new` being the id, so
// the form is not remounted when the address takes the real id). Finds the saved meal in the
// store, loads what the editor needs and shows MealEditorForm. Recipes are a separate editor.
export default function MealEditor() {
  const { id } = useParams()
  const location = useLocation()
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const isNew = id === 'new'
  const settings = useNutrition(s => s.settings)
  const meals = useNutrition(s => s.meals)
  const meal = isNew ? null : meals.list.find(m => m.id === Number(id) && !m.is_recipe) || null
  const prefill = useRef(location.state?.prefill || null).current
  const shown = useRef(false)
  const [fresh, setFresh] = useState(isNew)

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    if (!isNew) n.loadMeals({ recipes: false, force: true }).then(() => setFresh(true))
  }, [on])

  if (!on) {
    return (
      <StagePage title={t('Saved meal')} parent={MEALS_LIST}>
        <StageEmpty illustration="plate" title={t('Saved meals live in the web app')} body={t('Sign in on the web app to keep your saved meals here.')} />
      </StagePage>
    )
  }

  const settingsIn = settings.status === 'ready' || settings.status === 'error'
  if (!shown.current && (isNew || meal) && settingsIn) shown.current = true
  if (shown.current) return <MealEditorForm meal={meal} prefill={prefill} settings={settings.data} />

  if (!isNew && !meal && fresh) {
    return (
      <StagePage title={t('Saved meal')} parent={MEALS_LIST}>
        <StageEmpty illustration="search" title={t('This meal is not in My foods')} body={t('It may have been deleted on another device.')}
          action={t('Back to My foods')} onClick={() => leaveTo(MEALS_LIST)} />
      </StagePage>
    )
  }
  return (
    <StagePage title={t('Saved meal')} parent={MEALS_LIST}>
      <Loading />
    </StagePage>
  )
}
