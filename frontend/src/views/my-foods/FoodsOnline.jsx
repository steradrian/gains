import { t } from '../../lib/i18n.js'
import { useUI } from '../../store/useUI.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import { MIN_QUERY, useOnlineSearch } from '../../lib/nutrition/use-online-search.js'
import { foodDetailSheet } from '../../components/FoodDetailSheet.jsx'
import OnlineStatus from '../../components/OnlineStatus.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StageNote from '../../ds/StageNote.jsx'
import StageSection from '../../ds/StageSection.jsx'
import LibraryList from './LibraryList.jsx'
import LibraryRow from './LibraryRow.jsx'
import { foodSubtitle } from './library-text.js'

// The Open Food Facts source of the Foods tab (board Ea4Online). The search, its pacing, the
// offline and failure lines are the app's (use-online-search.js, OnlineStatus). A row opens the
// food in full, whose Save keeps it in your foods.
export default function FoodsOnline({ q, settings }) {
  const foods = useNutrition(s => s.foods)
  const country = settingOf(settings, 'offSearchCountry')
  const online = useOnlineSearch(q, { active: true, lang: settings?.offSearchLanguage || 'en', country })
  const query = q.trim()

  const save = async food => {
    await useNutrition.getState().saveFood(food)
    useUI.getState().toast(t('Saved to your foods'))
  }
  const owned = result => !!result.barcode && foods.list.some(f => f.barcode === result.barcode)

  let body
  if (query.length < MIN_QUERY) body = <StageEmpty illustration="search" title={t('Type a food to search Open Food Facts.')} />
  else if (online.status !== 'ready') body = <OnlineStatus online={online} query={query} />
  else if (!online.results.length) body = <StageEmpty illustration="search" title={t('No results online.')} />
  else {
    body = (
      <>
        <LibraryList>
          {online.results.map((result, i) => {
            const have = owned(result)
            return (
              <LibraryRow key={result.barcode || result.client_key || i} title={result.name} sub={foodSubtitle(result, settings)}
                tag={have ? t('Saved') : t('Online')}
                onClick={() => foodDetailSheet({ food: result, settings, onSave: have ? undefined : save })} />
            )
          })}
        </LibraryList>
        <StageNote>{t('Results from Open Food Facts are saved to your foods the first time you log or keep one, so you find them again offline.')}</StageNote>
      </>
    )
  }

  return (
    <>
      <StageSection title={t('Open Food Facts')} action={country && country !== 'World' ? t('{0} first', country) : undefined} />
      {body}
    </>
  )
}
