import Icon from '../components/Icon.jsx'
import { Thumb } from '../components/Media.jsx'
import { dateLocale, t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import { segments } from '../lib/search/match.js'

/** Text with the matched ranges drawn bold and underlined (`g-hl`): weight, never colour. */
export function Hl({ text, ranges }) {
  if (!ranges?.length) return text
  return segments(text, ranges).map((s, i) => (s.match ? <mark key={i} className="g-hl">{s.text}</mark> : s.text))
}

/** A search row's 44px picture slot (`size="lg"`: the best match's 72px): an exercise's still, a
 *  food's photo, a date block (weekday over day), or a glyph on glass. `media` is a result's. */
export function SearchMedia({ media, size }) {
  const cls = cx(size === 'lg' ? 'g-best-img' : 'g-srow-media')
  if (media?.kind === 'thumb') return <span className={cx(cls, 'g-srow-img')} aria-hidden="true"><Thumb ex={media.ex} /></span>
  if (media?.kind === 'photo') return <img className={cx(cls, 'g-srow-img')} src={media.src} alt="" loading="lazy" />
  if (media?.kind === 'date' && media.iso) {
    const d = new Date(media.iso + 'T12:00:00')
    return <span className={cx(cls, 'g-srow-date', size === 'lg' && 'g-best-ic')} aria-hidden="true">
      <small>{d.toLocaleDateString(dateLocale(), { weekday: 'short' })}</small><b>{d.getDate()}</b>
    </span>
  }
  return <span className={cx(cls, size === 'lg' && 'g-best-ic')} aria-hidden="true"><Icon name={media?.glyph || 'magnifier'} className="g-icon" /></span>
}

// One row of the search on the stage (bundle.js `SearchRow` tone stage, boards Sh0*): the picture,
// the title with what matched in bold, one line under it, and what trails (`trailing`: a value, an
// Off tag). A Recent row has its × (`onRemove`) beside it, its own button, named "Remove … from
// recent". The nothing-matches actions are the same row with a glyph. `optionProps` go onto the
// main button (a listbox option's role, id, aria-selected, tabIndex); its name is the title and
// the line, unless `label` says more.
export default function SearchRow({ title, ranges, sub, media, href, onClick, onRemove, trailing, label, optionProps }) {
  const body = <>
    <SearchMedia media={media} />
    <span className="g-srow-text">
      <span className="g-srow-title"><Hl text={title} ranges={ranges} /></span>
      {sub && <span className="g-srow-sub">{sub}</span>}
    </span>
    {trailing}
  </>
  const name = label || [title, sub].filter(Boolean).join(', ')
  return (
    <div className="g-srow-wrap g-srow-stage">
      {href
        ? <a {...optionProps} href={href} onClick={onClick} className="g-srow g-srow-main" aria-label={name}>{body}</a>
        : <button type="button" {...optionProps} onClick={onClick} className="g-srow g-srow-main" aria-label={name}>{body}</button>}
      {onRemove && <button type="button" className="g-srow-xbtn" onClick={onRemove} aria-label={t('Remove {0} from recent', title)}>
        <Icon name="xmark" className="g-icon" />
      </button>}
    </div>
  )
}
