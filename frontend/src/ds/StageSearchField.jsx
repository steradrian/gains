import { useId, useRef } from 'react'
import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'
import { cx } from '../lib/ui-kit.js'

// The search field on the stage (bundle.js `StageSearchField`, boards T6.0 and the search overlay's
// head): a glass pill with the magnifier and the input. Two places use it. With `closeHref` or
// `onClose` it is the overlay's head, a ringed field beside the glass × that closes the overlay, and
// `scope` is the white chip inside the field for a search narrowed to one kind. Without a close it is
// a field in a page (48px, a hairline ring): it ends in a × that empties the text (`clearLabel`) and
// the live count of what is left (`count`, said as `countLabel`), both only while they apply.
// `query` with `onChange` makes it controlled; `query` alone is the first text. Every spoken name
// comes from the caller: `label` for the input, `scopeLabel`, `closeLabel`, `clearLabel`, `countLabel`.
export default function StageSearchField({
  placeholder, label, query, onChange, autoFocus,
  scope, scopeHref, onClearScope, scopeLabel,
  closeHref, onClose, closeLabel,
  clearLabel, count, countLabel,
}) {
  const id = useId()
  const input = useRef(null)
  const overlay = !!(closeHref || onClose)
  const controlled = !!onChange && query !== undefined
  const text = controlled ? query : undefined
  const clear = () => { onChange?.(''); input.current?.focus() }
  return (
    <div className={cx('g-ssf', !overlay && 'g-ssf-page')}>
      <label className="g-ssf-box" htmlFor={id}>
        <Icon name="magnifier" className="g-icon" />
        {scope && (
          <span className="g-ssf-scope">
            {scope}
            <Act href={scopeHref} onClick={onClearScope} ariaLabel={scopeLabel} className="g-ssf-scope-x"><Icon name="xmark" className="g-icon" /></Act>
          </span>
        )}
        <input
          ref={input}
          id={id}
          type="search"
          value={text}
          defaultValue={controlled ? undefined : query}
          placeholder={placeholder}
          aria-label={label}
          autoFocus={autoFocus}
          onChange={onChange && (e => onChange(e.target.value))}
        />
        {!overlay && count != null && <span className="g-ssf-count" role="status" aria-label={countLabel}>{count}</span>}
        {!overlay && clearLabel && controlled && query !== '' && (
          <button type="button" className="g-ssf-clear" aria-label={clearLabel} onClick={clear}><Icon name="xmark" className="g-icon" /></button>
        )}
      </label>
      {overlay && (
        <Act href={closeHref} onClick={onClose} ariaLabel={closeLabel} className="g-ssf-close g-glass">
          <span className="g-ssf-spin"><Icon name="xmark" className="g-icon" /></span>
        </Act>
      )}
    </div>
  )
}
