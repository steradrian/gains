import { useContext, useId } from 'react'
import Icon from '../components/Icon.jsx'
import { SheetFrameContext } from '../components/sheet-frame.js'
import { dsAccentFor } from '../lib/ds-accent.js'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'
import { oneOf } from '../lib/ui-kit.js'

const TYPES = ['auto', 'half', 'full']

// The design system's light drawer (bundle.js `BottomSheet`): grab bar, title, the day and meal it
// writes to (`chip`, tappable through `onChip`), close ×, a body that scrolls inside, `footer`.
// `type`: auto (as tall as its content), half, full (56px from the top). `head` is pinned under the
// title, outside the scroll (a search field that stays while the results move, board T1.4).
//
// Opened through the app's sheet frame (`openSheet(render, { variant: 'ds' })`, Modals.jsx), the
// frame owns everything a sheet does: presence motion, focus in and back, Escape, back button,
// scrim and drag to dismiss, the page lock and the keyboard. The drawer only draws, on the refs
// the frame gives it. The × runs `onClose`, else the frame's dismiss (the scrim's, so a sheet's
// onDismiss runs either way). Outside the frame it draws itself open and still.
// `chipLabel` names a tappable chip that goes somewhere rather than says where it logs (a past
// workout's date, which opens that day). `chipIcon` is the glyph in the chip: the calendar for the
// day a drawer writes to, another for what it belongs to (the routine in the exercise picker and
// settings).
// `onBack` puts a ‹ before the title, for a drawer that is a stack of steps (Log food): it goes back
// one step, and `backLabel` says where ("Back to results").
export default function BottomSheet({ title, chip, onChip, chipLabel, chipIcon = 'calendar', type = 'auto', onClose, closeHref, onBack, backLabel, scrim = true, head, footer, children }) {
  oneOf('BottomSheet', 'type', type, TYPES)
  const frame = useContext(SheetFrameContext)
  const accent = useStore(s => dsAccentFor(s.S))
  const titleId = useId()
  const close = onClose || frame?.dismiss
  const hasClose = !!(onClose || closeHref || (frame && !frame.locked))
  const grab = !frame?.locked

  const panel = (
    <div className={'g-bs g-bs-' + type} ref={frame?.panel} {...frame?.panelProps}
      {...(frame ? null : { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId })}>
      {grab && <span className="g-bs-grab" aria-hidden="true" />}
      <div className="g-bs-head">
        {onBack && <button type="button" onClick={onBack} className="g-bs-back" aria-label={backLabel || t('Back')}><Icon name="chevronLeft" className="g-icon" /></button>}
        <h2 id={titleId}>{title}</h2>
        {chip && (onChip
          ? <button type="button" className="g-bs-chip" onClick={onChip} aria-label={chipLabel || t('Logging to {0}', chip)}><Icon name={chipIcon} className="g-icon" />{chip}</button>
          : <span className="g-bs-chip"><Icon name={chipIcon} className="g-icon" />{chip}</span>)}
        {hasClose && (closeHref
          ? <a href={closeHref} onClick={onClose} className="g-bs-x" aria-label={t('Close')}><Icon name="xmark" className="g-icon" /></a>
          : <button type="button" onClick={close} className="g-bs-x" aria-label={t('Close')}><Icon name="xmark" className="g-icon" /></button>)}
      </div>
      {head && <div className="g-bs-pin">{head}</div>}
      <div className="g-bs-body" ref={frame?.body}>{children}</div>
      {footer && <div className="g-bs-foot">{footer}</div>}
    </div>
  )

  // In the frame it is its own design-system root, in the accent the app's maps to.
  if (frame) return (
    <div className="g-root g-bs-wrap" data-accent={accent}>
      <div className="g-bs-scrim" ref={frame.scrim} aria-hidden="true" onClick={frame.dismiss} />
      {panel}
    </div>
  )
  return (
    <div className="g-bs-wrap">
      {scrim && <div className="g-bs-scrim" aria-hidden="true" onClick={onClose} />}
      {panel}
    </div>
  )
}
