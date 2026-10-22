import CheerRow from './CheerRow.jsx'

// The cheers of the week in one glass card, rows edge to edge with a hairline between them (the
// card is NotificationGroup's). `label` names the list for a screen reader ("Cheers this week");
// `rows` are CheerRow's props plus a `key`.
export default function CheerList({ rows, label }) {
  return (
    <div className="g-ngroup">
      <ul className="g-ngroup-card g-glass g-clist" aria-label={label}>
        {rows.map(({ key, ...row }) => <CheerRow key={key} {...row} />)}
      </ul>
    </div>
  )
}
