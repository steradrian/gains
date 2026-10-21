import Icon from '../components/Icon.jsx'
import Act from './Act.jsx'

// The top of the running workout on the stage (boards W1.0, W1.29, W1.28, W1.30): a glass button
// at the start (Minimise ⌄, or × when `closeIcon` is set, as the editor of a saved workout has it),
// the title over the clock, and the white pill at the end (Finish, Save, Discard). The chips the
// design system once drew here are superseded. Nothing ticks in here: `clock` is whatever the
// caller shows (a running time, a date line) and `status` the line under it ("Offline · 6 waiting"),
// with `statusIcon` its glyph. Every string, the spoken names included, is the caller's.
export default function WorkoutTopBar({
  title, clock, status, statusIcon = 'wifiOff',
  closeIcon = false, minimiseLabel, minimiseHref, onMinimise, closeLabel, closeHref, onClose,
  finishLabel, finishHref, onFinish,
}) {
  return (
    <div className="g-wtop">
      {closeIcon ? (
        <Act href={closeHref} onClick={onClose} ariaLabel={closeLabel} className="g-wtop-btn g-glass">
          <Icon name="xmark" className="g-icon" />
        </Act>
      ) : (
        <Act href={minimiseHref} onClick={onMinimise} ariaLabel={minimiseLabel} className="g-wtop-btn g-glass">
          <Icon name="chevronDown" className="g-icon" />
        </Act>
      )}
      <span className="g-wtop-mid">
        <span className="g-wtop-title">{title}</span>
        {clock != null && clock !== '' && <b className="g-wtop-clock">{clock}</b>}
        {status && (
          <span className="g-wtop-status">
            <Icon name={statusIcon} className="g-icon" />
            {status}
          </span>
        )}
      </span>
      <Act href={finishHref} onClick={onFinish} className="g-wtop-finish">{finishLabel}</Act>
    </div>
  )
}
