import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { RECIPES_LIST } from '../../lib/nutrition/editor-routes.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { Loading } from '../../components/Loader.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import RecipeEditorForm from './RecipeEditorForm.jsx'

// /food/my-foods/recipes/:id, and /food/my-foods/recipes/new (the same route, `new` being the id,
// so the form is not remounted when the address takes the real id). Finds the recipe in the store,
// loads what the editor needs and shows RecipeEditorForm.
export default function RecipeEditor() {
  const { id } = useParams()
  const location = useLocation()
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const isNew = id === 'new'
  const settings = useNutrition(s => s.settings)
  const recipes = useNutrition(s => s.recipes)
  const recipe = isNew ? null : recipes.list.find(m => m.id === Number(id) && m.is_recipe) || null
  const prefill = useRef(location.state?.prefill || null).current
  const shown = useRef(false)
  const [fresh, setFresh] = useState(isNew)

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    if (!isNew) n.loadMeals({ recipes: true, force: true }).then(() => setFresh(true))
  }, [on])

  if (!on) {
    return (
      <StagePage title={t('Recipe')} parent={RECIPES_LIST}>
        <StageEmpty illustration="plate" card={false} title={t('Recipes live in the web app')} body={t('Sign in on the web app to keep your recipes here.')} />
      </StagePage>
    )
  }

  const settingsIn = settings.status === 'ready' || settings.status === 'error'
  if (!shown.current && (isNew || recipe) && settingsIn) shown.current = true
  if (shown.current) return <RecipeEditorForm recipe={recipe} prefill={prefill} settings={settings.data} />

  if (!isNew && !recipe && fresh) {
    return (
      <StagePage title={t('Recipe')} parent={RECIPES_LIST}>
        <StageEmpty illustration="search" card={false} title={t('This recipe is not in My foods')} body={t('It may have been deleted on another device.')}
          action={t('Back to My foods')} onClick={() => leaveTo(RECIPES_LIST)} />
      </StagePage>
    )
  }
  return (
    <StagePage title={t('Recipe')} parent={RECIPES_LIST}>
      <Loading />
    </StagePage>
  )
}
