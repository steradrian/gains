// A quiet line of fine print at the foot of a pushed page on the stage (board Sh3Notifications:
// "Kept for 30 days."). StageFooter is the pinned
// bar with the buttons; this is only said, in the page's flow. Text comes from the caller.
export default function StageNote({ children }) {
  return <p className="g-snote">{children}</p>
}
