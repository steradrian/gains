import Button from './Button.jsx'

// Two photos side by side with the change between them (board Me2Compare). Each side is
// `{ image, date, caption, changeLabel, onChange }`: the picture (the caller's element), its day, that
// day's weight when there is one, and the button that picks another photo for that side. `line` is
// the sentence under both ("77 days apart · -3.6 kg"). A photo has no reading direction, so the
// earlier one stays on the left in every language. Every string comes from the caller.
function Side({ image, date, caption, changeLabel, onChange }) {
  return (
    <figure className="g-cmp-side">
      <div className="g-cmp-img">{image}</div>
      <figcaption className="g-cmp-cap"><b>{date}</b>{caption && <span>{caption}</span>}</figcaption>
      <Button variant="glass" size="sm" block onClick={onChange}>{changeLabel}</Button>
    </figure>
  )
}

export default function CompareView({ before, after, line }) {
  return (
    <div className="g-cmp">
      <div className="g-cmp-pair" dir="ltr">
        <Side {...before} />
        <Side {...after} />
      </div>
      {line && <p className="g-cmp-line">{line}</p>}
    </div>
  )
}
