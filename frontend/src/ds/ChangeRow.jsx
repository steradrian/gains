import GlassRow from './GlassRow.jsx'

// One entry of Recent changes (board M4.0): what happened, the line under it (where, the numbers,
// the time) and one control at the end, a `Button` (Restore, Undo) or a `Tag` (Restored). A
// `GlassRow` composition: the row itself does nothing, so the only thing to tap is the control.
// Every string comes from the caller.
export default function ChangeRow({ title, detail, trailing }) {
  return <GlassRow title={title} sub={detail} trailing={trailing} />
}
