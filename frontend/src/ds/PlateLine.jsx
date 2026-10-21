import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

// The plate line under a barbell set, on the stage (board W1.2): "Bar 20 kg + 25 + 5 each side",
// one glass row that opens the plate drawer. `text` is what the caller worked out, `label` the
// spoken name ("Plate loading"). Nothing draws without a `text`.
export default function PlateLine({ text, href, onClick, label }) {
  if (!text) return null
  return (
    <Act href={href} onClick={onClick} ariaLabel={label} className="g-plline g-glass">
      <Icon name="plate" className="g-icon" />
      <span>{text}</span>
      <Icon name="chevronRight" className="g-icon g-plline-chev" />
    </Act>
  )
}
