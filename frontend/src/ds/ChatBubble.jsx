import { cx } from '../lib/ui-kit.js'

// A message in the Coach's thread (bundle.js `ChatBubble`): the Coach on glass at the start, your
// own in white at the end; in RTL the two sides swap with the text. `text`, or `children` for a
// list or a card. `who` is the spoken sender ("Coach", "You") and `time` the shown stamp, both
// from the caller. `error` tints a Coach line that says a run failed.
export default function ChatBubble({ me, text, time, who, error, children }) {
  return (
    <div className={cx('g-bubble', me ? 'g-bubble-me' : 'g-bubble-them g-glass', error && 'g-bubble-error')}>
      {who && <span className="g-sr">{who}</span>}
      {children || text}
      {time && <small>{time}</small>}
    </div>
  )
}
