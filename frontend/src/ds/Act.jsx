// The design system's tappable: a link when it has somewhere to go (`href`), otherwise a button
// (bundle.js `Act`). The components that can be either render through it. `pressed` is a
// button's toggled state and `disabled` its busy one; a link has neither. `glass` is the liquid-glass
// kind (data-glass) for a caller that must say it rather than leave it to inference.
export default function Act({ href, onClick, className, ariaLabel, pressed, disabled, glass, children }) {
  if (href) return <a href={href} onClick={onClick} className={className} aria-label={ariaLabel} data-glass={glass}>{children}</a>
  return <button type="button" onClick={onClick} className={className} aria-label={ariaLabel} aria-pressed={pressed} disabled={disabled} data-glass={glass}>{children}</button>
}
