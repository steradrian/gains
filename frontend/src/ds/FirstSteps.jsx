import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import Act from './Act.jsx'

// The first steps on Today, on the stage (bundle.js `FirstSteps`, in the form board T1.9 draws:
// a glass list under a StageSection, not the light card). steps: [{ title, sub, done, href,
// onClick }]. A step to do is a link or button with a chevron; a done one ticks in a white disc,
// is struck through and is only said. The StageSection above it holds "First steps" and "1 of 4".
export default function FirstSteps({ steps }) {
  return (
    <ol className="g-fsteps g-glass">
      {steps.map((s, i) => {
        const open = !s.done && !!(s.href || s.onClick)
        const kids = (
          <>
            <span className={s.done ? 'g-fstep-dot on' : 'g-fstep-dot'}>{s.done && <Icon name="check" className="g-icon" />}</span>
            <span className="g-fstep-body">
              <b>{s.done && <span className="g-sr">{t('Done')}: </span>}{s.title}</b>
              {s.sub && <span>{s.sub}</span>}
            </span>
            {open && <Icon name="chevronRight" className="g-icon g-fstep-chev" />}
          </>
        )
        return (
          <li key={i + s.title} className={s.done ? 'g-fstep done' : 'g-fstep'}>
            {open
              ? <Act href={s.href} onClick={s.onClick} className="g-fstep-row">{kids}</Act>
              : <div className="g-fstep-row">{kids}</div>}
          </li>
        )
      })}
    </ol>
  )
}
