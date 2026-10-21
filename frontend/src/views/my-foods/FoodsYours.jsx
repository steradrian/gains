import { useNavigate } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { foodErrorText, visibleFoods } from '../../lib/nutrition/foods.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { MIN_QUERY } from '../../lib/nutrition/use-online-search.js'
import { LoadError } from '../../components/blocks.jsx'
import { LoadingList } from '../../components/Loader.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageSection from '../../ds/StageSection.jsx'
import LibraryList from './LibraryList.jsx'
import LibraryRow from './LibraryRow.jsx'
import { foodSubtitle, splitFavourites } from './library-text.js'

// The Yours source of the Foods tab (board Ea4MyFoods): Favourites, then All foods with how many.
// A row opens the food in its editor. `q` filters by name or brand; `onSearchOnline` (only while
// Open Food Facts is on) turns a search with no match into a search there.
export default function FoodsYours({ q, settings, onNew, onSearchOnline }) {
  const nav = useNavigate()
  const foods = useNutrition(s => s.foods)
  const sort = settingOf(settings, 'foodsSort')

  if (foods.status === 'error' && !foods.list.length) {
    return <LoadError message={foodErrorText(foods.error)} onRetry={() => useNutrition.getState().loadFoods({ force: true })} />
  }
  if (foods.status !== 'ready' && !foods.list.length) return <LoadingList />
  if (!foods.list.length) {
    return <StageEmpty illustration="plate" title={t('No foods yet')}
      body={onSearchOnline ? t('Create a food, or search online and save one.') : t('Create a food to find it here.')}
      action={t('New food')} onClick={onNew} />
  }

  const { favourites, rest } = splitFavourites(visibleFoods(foods.list, { query: q, sort }))
  if (!favourites.length && !rest.length) {
    return <StageEmpty illustration="search" title={t('No match')}
      action={onSearchOnline && q.trim().length >= MIN_QUERY ? t('Search online') : undefined} onClick={onSearchOnline} />
  }

  const rows = list => (
    <LibraryList>
      {list.map(food => (
        <LibraryRow key={food.id} title={food.name} sub={foodSubtitle(food, settings)} favourite={!!food.favorite}
          onClick={() => nav(`/food/my-foods/foods/${food.id}`)} />
      ))}
    </LibraryList>
  )
  return (
    <>
      {favourites.length > 0 && <><StageSection title={t('Favourites')} />{rows(favourites)}</>}
      {rest.length > 0 && <><StageSection title={t('All foods')} action={String(rest.length)} />{rows(rest)}</>}
    </>
  )
}
