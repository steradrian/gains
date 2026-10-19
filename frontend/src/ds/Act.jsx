// The design system's tappable: a link when it has somewhere to go (`href`), otherwise a button
// (bundle.js `Act`). The components that can be either render through it. `pressed` is a
// button's toggled state; a link has none.
export default function Act({ href, onClick, className, ariaLabel, pressed, children }) {
  if (href) return <a href={href} onClick={onClick} className={className} aria-label={ariaLabel}>{children}</a>
  return <button type="button" onClick={onClick} className={className} aria-label={ariaLabel} aria-pressed={pressed}>{children}</button>
}
