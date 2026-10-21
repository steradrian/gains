import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { Hl, SearchMedia } from './SearchRow.jsx'

// The one result that clearly wins (bundle.js `BestMatch`, board Sh0Results): a larger glass card,
// "Best match · Exercise" over the title with what matched in bold, one line, a chevron; the whole
// card one link or button. `kind` is the row's kind, translated (lib/search/results.js kindLabel);
// `media` a result's. `optionProps` go onto it (a listbox option's role, id, aria-selected).
export default function BestMatch({ kind, title, ranges, sub, media, href, onClick, optionProps }) {
  const eyebrow = kind ? t('Best match · {0}', kind) : t('Best match')
  const body = <>
    <SearchMedia media={media} size="lg" />
    <span className="g-best-body">
      <span>{eyebrow}</span>
      <b><Hl text={title} ranges={ranges} /></b>
      {sub && <span>{sub}</span>}
    </span>
    <Icon name="chevronRight" className="g-icon g-best-chev" />
  </>
  const name = [eyebrow, title, sub].filter(Boolean).join(', ')
  return href
    ? <a {...optionProps} href={href} onClick={onClick} className="g-best g-glass" aria-label={name}>{body}</a>
    : <button type="button" {...optionProps} onClick={onClick} className="g-best g-glass" aria-label={name}>{body}</button>
}
