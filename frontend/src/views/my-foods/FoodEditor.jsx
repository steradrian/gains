import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { t } from '../../lib/i18n.js'
import { nutritionAvailable } from '../../lib/nutrition/api.js'
import { FOODS_LIST } from '../../lib/nutrition/editor-routes.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { leaveTo } from '../../lib/use-tab-nav.js'
import { Loading } from '../../components/Loader.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import FoodEditorForm from './FoodEditorForm.jsx'

// /food/my-foods/foods/:id, and /food/my-foods/foods/new (the same route: `new` is the id, so
// replacing the address with the real id once the food exists does not remount the form and take
// the keyboard away; App's route layer keys the three editor routes alike, see editorRouteKey in
// lib/nutrition/editor-routes.js). Finds the food in the store, loads what the editor needs, and shows the
// form; the form itself is FoodEditorForm.
export default function FoodEditor() {
  const { id } = useParams()
  const location = useLocation()
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const isNew = id === 'new'
  const settings = useNutrition(s => s.settings)
  const foods = useNutrition(s => s.foods)
  const food = isNew ? null : foods.list.find(f => f.id === Number(id)) || null
  // The prefill rides in the location state, which the replace to the real id clears: keep it.
  const prefill = useRef(location.state?.prefill || null).current
  // Once the form has been shown it stays, whatever a list reload does to the food under it.
  const shown = useRef(false)
  const [fresh, setFresh] = useState(isNew)

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    if (!isNew) n.loadFoods({ force: true }).then(() => setFresh(true))
  }, [on])

  if (!on) {
    return (
      <StagePage title={t('Edit food')} parent={FOODS_LIST}>
        <StageEmpty illustration="plate" title={t('Foods live in the web app')} body={t('Sign in on the web app to keep your foods here.')} />
      </StagePage>
    )
  }

  const settingsIn = settings.status === 'ready' || settings.status === 'error'
  if (!shown.current && (isNew || food) && settingsIn) shown.current = true
  if (shown.current) return <FoodEditorForm food={food} prefill={prefill} settings={settings.data} />

  if (!isNew && !food && fresh) {
    return (
      <StagePage title={t('Edit food')} parent={FOODS_LIST}>
        <StageEmpty illustration="search" title={t('This food is not in My foods')} body={t('It may have been deleted on another device.')}
          action={t('Back to My foods')} onClick={() => leaveTo(FOODS_LIST)} />
      </StagePage>
    )
  }
  return (
    <StagePage title={isNew ? t('New food') : t('Edit food')} parent={FOODS_LIST}>
      <Loading />
    </StagePage>
  )
}
