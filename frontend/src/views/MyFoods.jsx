import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { useNutrition } from '../lib/nutrition/store.js'
import StageEmpty from '../ds/StageEmpty.jsx'
import StagePage from '../ds/StagePage.jsx'
import StageSegmented from '../ds/StageSegmented.jsx'
import CatalogTab from './my-foods/CatalogTab.jsx'
import FoodsTab from './my-foods/FoodsTab.jsx'

const TABS = ['foods', 'meals', 'recipes']
// The editors library-m2 and library-m3 register; until they merge a New lands on the fallback route.
const NEW_PATH = {
  foods: '/food/my-foods/foods/new',
  meals: '/food/my-foods/meals/new',
  recipes: '/food/my-foods/recipes/new',
}

// Eat > My foods (boards Ea4MyFoods and its siblings): your foods, saved meals and recipes in one
// page. The tab is in the URL (`?tab=foods|meals|recipes`, replacing, so Back leaves the page);
// the Foods tab's source is `&source=off`. The + in the bar makes a new one of the tab on show.
export default function MyFoods() {
  const user = useStore(s => s.user)
  const on = nutritionAvailable(user)
  const settings = useNutrition(s => s.settings.data)
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const tab = TABS.includes(asked) ? asked : 'foods'

  useEffect(() => {
    if (!on) return
    const n = useNutrition.getState()
    n.loadSettings()
    n.loadFoods({ force: true })
  }, [on])

  if (!on) {
    return (
      <StagePage title={t('My foods')} parent="/food">
        <StageEmpty illustration="plate" title={t('Foods live in the web app')} body={t('Sign in on the web app to keep your foods here.')} />
      </StagePage>
    )
  }

  const create = () => nav(NEW_PATH[tab])
  const label = { foods: t('New food'), meals: t('New saved meal'), recipes: t('New recipe') }[tab]
  return (
    <StagePage title={t('My foods')} parent="/food" actions={[{ icon: 'plus', label, onClick: create }]}>
      <StageSegmented label={t('My foods')} value={tab} onChange={next => setParams({ tab: next }, { replace: true })}
        options={[{ value: 'foods', label: t('Foods') }, { value: 'meals', label: t('Saved meals') }, { value: 'recipes', label: t('Recipes') }]} />
      {tab === 'foods' && <FoodsTab settings={settings} onNew={create} />}
      {tab === 'meals' && <CatalogTab recipes={false} settings={settings} onNew={create} />}
      {tab === 'recipes' && <CatalogTab recipes settings={settings} onNew={create} />}
    </StagePage>
  )
}
