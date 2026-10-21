import Icon from '../components/Icon.jsx'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'

// The "Your loop" card of the Plan page (board Tr3Plan): a title with a quiet line on its right
// ("3 workouts, then repeat"), the routines as chips in order with a chevron between them, the
// one up next lit white and the ones done this round ticked, then a line under them. `items` are
// `{ id, n, name, state, label }`: `state` 'next', 'done', 'pinned', 'later' or null, `label` what
// a screen reader says for the chip ("1. Push A, Up next"). `numbered` puts `n` in each chip.
// `empty` is said in place of the chips when there are none. `action` is one quiet text button
// on the right of the title, `{ label, onClick, pressed }` (Edit / Done). Strings come from the caller.
export default function LoopStrip({ title, line, items = [], numbered = true, empty, note, action }) {
  return (
    <section className="g-loop g-glass">
      <div className="g-loop-top">
        <h2 className="g-loop-title">{title}</h2>
        {line && <span className="g-loop-line">{line}</span>}
        {action && <Act onClick={action.onClick} pressed={action.pressed} className="g-loop-act">{action.label}</Act>}
      </div>
      {items.length > 0
        ? (
          <ol className="g-loop-chips">
            {items.map((it, i) => (
              <li key={it.id} className="g-loop-item">
                {i > 0 && <Icon name="chevronRight" className="g-icon g-loop-sep" />}
                <span aria-hidden="true" className={cx('g-loop-chip', it.state === 'next' && 'on', it.state === 'done' && 'done')}>
                  {it.state === 'done' ? <Icon name="check" className="g-icon" /> : numbered && <span className="g-loop-n">{it.n}</span>}
                  {it.name}
                </span>
                <span className="sr-only">{it.label}</span>
              </li>
            ))}
          </ol>
        )
        : empty && <p className="g-loop-empty">{empty}</p>}
      {note && <p className="g-loop-note">{note}</p>}
    </section>
  )
}
