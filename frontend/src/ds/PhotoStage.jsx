import IconButton from './IconButton.jsx'

// The frame of a full-screen photo overlay (boards Me2Viewer and Me2Compare): a top bar with the
// close button, the title and a count ("2 of 6", spoken politely when it changes), the content, and
// an action bar of buttons under it. The overlay is dark whatever the theme, like the camera roll.
// `label` names the dialog. Extra props (`onKeyDown`, `tabIndex`) land on the dialog. Every string
// comes from the caller.
export default function PhotoStage({ label, title, count, closeLabel, onClose, actions, children, ...rest }) {
  return (
    <div className="g-pstage" role="dialog" aria-modal="true" aria-label={label} {...rest}>
      <header className="g-pstage-bar">
        <IconButton icon="xmark" label={closeLabel} tone="glass" onClick={onClose} />
        <h2 className="g-pstage-title">{title}</h2>
        <span className="g-pstage-count" aria-live="polite">{count}</span>
      </header>
      <div className="g-pstage-body">{children}</div>
      {actions && <footer className="g-pstage-acts">{actions}</footer>}
    </div>
  )
}
