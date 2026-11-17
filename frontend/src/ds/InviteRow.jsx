import GlassRow from './GlassRow.jsx'

// One invite or ask on the Invite page (boards M5.0 to M5.2): a name, the line under it (Waiting,
// Joined, Expired, the note) and, at the end, a `Button` (New invite, New link) or a `Tag` (New).
// A `GlassRow` composition. The whole row is a button only when it has an `onClick` (a Waiting
// invite opens its menu) and a plain card otherwise; give it an `onClick` or a `Button` in
// `trailing`, never both, so there is one thing to tap. Every string comes from the caller.
export default function InviteRow({ title, line, trailing, onClick }) {
  return <GlassRow title={title} sub={line} trailing={trailing ?? (onClick ? 'chev' : undefined)} onClick={onClick} />
}
