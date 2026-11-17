import { useState } from 'react'

// A superset's two tabs on the stage (boards W1.24, W1.38): "A1 Lateral raise | A2 Pushdown", and
// the note under them ("Superset · go straight to A2, rest 1:00 after both"). Press one to work
// that exercise; `active` ('a' | 'b') and `onChange(k)` make it controlled, otherwise it keeps its
// own. `a` and `b` are the exercise names, `tags` the two short codes in front of them (A1, A2)
// and `ariaLabel` the group's name. Every string is the caller's.
export default function SupersetSwitch({ a, b, tags = ['A1', 'A2'], active, onChange, note, ariaLabel }) {
  const [own, setOwn] = useState('a')
  const on = active ?? own
  const pick = k => {
    if (active == null) setOwn(k)
    onChange?.(k)
  }
  const seg = (k, tag, name) => (
    <button type="button" className={on === k ? 'g-ssw-s on' : 'g-ssw-s'} aria-pressed={on === k} onClick={() => pick(k)}>
      <b>{tag}</b> <span>{name}</span>
    </button>
  )
  return (
    <div className="g-ssw-wrap">
      <div className="g-ssw g-glass" role="group" aria-label={ariaLabel}>
        {seg('a', tags[0], a)}
        {seg('b', tags[1], b)}
      </div>
      {note && <p className="g-ssw-note">{note}</p>}
    </div>
  )
}
