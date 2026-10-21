import Chip from '../../../ds/Chip.jsx'
import { fmtNum } from '../../../lib/format.js'
import { t } from '../../../lib/i18n.js'
import { choiceSheet } from './choice-sheet.jsx'
import { sentence } from './exercise-lines.js'
import { EQUIP_ANY, EQUIP_PROFILE } from './use-exercise-filters.js'

// The filter chips under the body parts on Exercises and By muscle: Any equipment ▾ and Any type ▾
// open a light drawer to choose from, Favourites · N filters to the starred ones. The equipment
// drawer also holds the active gym profile's filter, as its first choice, so "what you have in
// Home gym" and "any equipment" are one tap apart. `f` is useExerciseFilters().
export default function FilterChips({ f }) {
  const { profile } = f
  const filtering = !!profile && !f.showAll
  const openEquipment = () => choiceSheet({
    title: t('Equipment'),
    options: [
      ...(profile ? [{ value: EQUIP_PROFILE, title: t('What you have in {0}', profile.name) }] : []),
      { value: EQUIP_ANY, title: t('Any equipment') },
      ...f.eqOpts.map(x => ({ value: x, title: sentence(t(x)) })),
    ],
    value: f.equipChoice,
    onPick: f.chooseEquipment,
  })
  const openType = () => choiceSheet({
    title: t('Type of exercise'),
    options: [{ value: '', title: t('Any type') }, ...f.catOpts.map(x => ({ value: x, title: sentence(t(x)) }))],
    value: f.cat,
    onPick: f.setCat,
  })
  return (
    <div className="g-xf" role="group" aria-label={t('Filters')}>
      {(profile || f.eqOpts.length > 1 || f.eq) && (
        <Chip opens pressed={!!f.eq || filtering} onClick={openEquipment}>
          {f.eq ? sentence(t(f.eq)) : filtering ? profile.name : t('Any equipment')}
        </Chip>
      )}
      {(f.catOpts.length > 1 || f.cat) && (
        <Chip opens pressed={!!f.cat} onClick={openType}>{f.cat ? sentence(t(f.cat)) : t('Any type')}</Chip>
      )}
      <Chip pressed={f.favOnly} count={f.favCount ? fmtNum(f.favCount) : undefined} onClick={() => f.setFavOnly(!f.favOnly)}>{t('Favourites')}</Chip>
    </div>
  )
}
