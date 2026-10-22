import { Children } from 'react'

// The responsive grid of PhotoTile (board Me2Photos): three across on a phone, more as the stage
// widens, in the order given. A list, named by the caller (`label`). Tiles are its children.
export default function PhotoGrid({ label, children }) {
  return (
    <ul className="g-pgrid" aria-label={label}>
      {Children.toArray(children).map((child, i) => <li key={child.key ?? i}>{child}</li>)}
    </ul>
  )
}
