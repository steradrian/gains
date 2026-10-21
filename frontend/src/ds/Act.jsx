// The design system's tappable: a link when it has somewhere to go (`href`), otherwise a button
// (bundle.js `Act`). The components that can be either render through it. `pressed` is a
// button's toggled state and `disabled` its busy one; a link has neither.
export default function Act({ href, onClick, className, ariaLabel, pressed, disabled, children }) {
  if (href) return <a href={href} onClick={onClick} className={className} aria-label={ariaLabel}>{children}</a>
  return <button type="button" onClick={onClick} className={className} aria-label={ariaLabel} aria-pressed={pressed} disabled={disabled}>{children}</button>
}
