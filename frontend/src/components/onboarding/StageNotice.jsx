import Icon from '../Icon.jsx'

// A screen's one notice where it has no scene (the invite opened offline, or while signed in): a
// glass disc with the icon, a line and what to do, centred, as the O1.4 and O1.5 boards draw it.
export default function StageNotice({ icon, title, children }) {
  return (
    <div className="ob-notice">
      <span className="ob-notice-ic g-glass"><Icon name={icon} className="g-icon" /></span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  )
}
