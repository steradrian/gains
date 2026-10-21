import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// The control at the end of the row. play is the one solid white control (Up next); resume is the
// same white as a pill with its word (a workout is running); check is a quiet glass trophy (done)
// and chev a smaller glass chevron (a rest day). Anything else is drawn as given.
function Trail({ trailing }) {
  if (trailing === 'play') return <span className="g-trail g-trail-solid"><Icon name="play" className="g-icon" /></span>
  if (trailing === 'resume') return <span className="g-trail-pill"><Icon name="play" className="g-icon" />{t('Resume')}</span>
  if (trailing === 'check') return <span className="g-trail g-trail-md g-glass"><Icon name="trophy" className="g-icon" /></span>
  if (trailing === 'chev') return <span className="g-trail g-trail-sm g-glass"><Icon name="chevronRight" className="g-icon" /></span>
  return trailing ?? null
}

// A glass row on the stage (bundle.js `GlassRow`): an eyebrow, a title, a line under it and one
// trailing control. Up next on Today. With neither `href` nor `onClick` it is a plain card.
export default function GlassRow({ eyebrow, title, sub, trailing, href, onClick }) {
  const kids = (
    <>
      <span className="g-grow-body">
        {eyebrow && <span className="g-grow-k">{eyebrow}</span>}
        <b>{title}</b>
        {sub && <span className="g-grow-k">{sub}</span>}
      </span>
      <Trail trailing={trailing} />
    </>
  )
  return href || onClick
    ? <Act href={href} onClick={onClick} className="g-grow g-glass">{kids}</Act>
    : <div className="g-grow g-glass">{kids}</div>
}
