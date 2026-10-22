import Icon from '../components/Icon.jsx'
import { reducedMotion } from '../lib/reduced-motion.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import Illustration from './Illustration.jsx'

// The empty state of a stage page (bundle.js `StageEmpty`, boards T2.9 and later empties): a glass
// disc with a line icon (or, with `illustration`, one of the line-art scenes in white: the
// onboarding's or empty-scenes.js's bell, dumbbell, plate, calendar, chart, search; it draws in
// every time the page shows, and is simply there under reduced motion), a title, a
// line, then buttons. `action` with `href` / `onClick` is the one white button; `actions` adds
// more under it, [{ label, icon, href, onClick, solid }], glass unless `solid`, as T2.9 draws
// three (the bundle allows one). With `card={false}` it sits on the stage bare (search,
// notifications). `tone="light"` is for a light drawer (the Log food sheet), where white on the
// white surface would vanish. Strings come from the caller.
export default function StageEmpty({ icon = 'info', illustration, title, body, action, href, onClick, actions = [], card = true, tone = 'stage' }) {
  const buttons = [...(action ? [{ label: action, href, onClick, solid: true }] : []), ...actions]
  return (
    <div className={cx('g-sempty', card && 'g-glass g-sempty-card', tone === 'light' && 'g-sempty-light')}>
      {illustration
        ? <Illustration name={illustration} tone={tone} draw={!reducedMotion()} width={200} />
        : <span className="g-sempty-ic" aria-hidden="true"><Icon name={icon} className="g-icon" /></span>}
      <b>{title}</b>
      {body && <span>{body}</span>}
      {buttons.length > 0 && (
        <div className="g-sempty-acts">
          {buttons.map(a => (
            <Act key={a.label} href={a.href} onClick={a.onClick} className={cx('g-sempty-btn', a.solid && 'solid')}>
              {a.icon && <Icon name={a.icon} className="g-icon" />}
              {a.label}
            </Act>
          ))}
        </div>
      )}
    </div>
  )
}
