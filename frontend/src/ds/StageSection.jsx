import Act from './Act.jsx'

// A section title on the stage (bundle.js `StageSection`) with a quiet value or link on the right:
// "See day", "1.25 of 2.5 L". The right-hand text is a link or button only when it has
// somewhere to go (`actionHref`, `onAction`); otherwise it is just said.
export default function StageSection({ title, action, actionHref, onAction }) {
  return (
    <div className="g-ssec">
      <h2>{title}</h2>
      {action && (actionHref || onAction
        ? <Act href={actionHref} onClick={onAction} className="g-ssec-act">{action}</Act>
        : <span className="g-ssec-act">{action}</span>)}
    </div>
  )
}
