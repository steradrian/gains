import { t } from '../../lib/i18n.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import Icon from '../Icon.jsx'
import { Tag } from '../blocks.jsx'
import Highlight from './Highlight.jsx'
import ResultMedia from './ResultMedia.jsx'

/** What a row's trailing column says, for its text and its accessible name. */
function useTrailing(r) {
  const units = useUnits()
  if (r.value == null || r.value === '') return null
  if (r.unit === 'kcal') return { value: units.energyValue(r.value), unit: r.per100 ? t('{0} / 100 g', units.energyUnit) : units.energyUnit }
  return { value: r.value, unit: r.unit || null }
}

// One result row off the stage, in a food picker's Open Food Facts card (OnlineStatus.jsx): a plain
// button over the whole row, 64px, the media slot, the title over the subtitle with the matched
// words in bold, and what trails it: a value ("420" over "kcal"), a setting's current value, the
// "Off" label of a feature that is off, or a page's chevron (ui-search.md §7, §8). `reason` (a
// suggestion) leads the subtitle. The global search draws its rows on the stage (ds/SearchRow).
export default function ResultRow({ r, onOpen }) {
  const trailing = useTrailing(r)
  const isSetting = r.type === 'setting'
  const subtitle = r.reason ? [r.reason, r.subtitle].filter(Boolean).join(' · ') : r.subtitle
  const label = [
    r.fav ? t('Favourite') : null, r.title, subtitle,
    r.off ? t('feature off, opens Features') : null,
    trailing ? [trailing.value, trailing.unit].filter(Boolean).join(' ') : null,
  ].filter(Boolean).join(', ')
  return (
    <button type="button" className={'sr-row' + (r.off ? ' off' : '')} onClick={() => onOpen(r)} aria-label={label}>
      <ResultMedia media={r.media} />
      <span className="sr-text">
        <span className="sr-title">{r.fav && <Icon name="starFill" className="sr-fav" />}<Highlight text={r.title} ranges={r.ranges} /></span>
        {subtitle && <span className="sr-sub">{r.reason && <span className="sr-reason">{r.reason} · </span>}<Highlight text={r.subtitle || ''} ranges={r.subRanges} /></span>}
      </span>
      {r.off ? <Tag tone="dim" nocap>{t('Off')}</Tag>
        : isSetting ? (trailing && <span className="sr-setval">{trailing.value}</span>)
        : trailing ? <span className="sr-trail"><span className="sr-v">{trailing.value}</span>{trailing.unit && <span className="sr-u">{trailing.unit}</span>}</span>
        : r.type === 'page' ? <Icon name="chevronRight" className="sr-chev" /> : null}
    </button>
  )
}
