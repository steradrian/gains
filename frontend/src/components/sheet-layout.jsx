import { Children, Fragment, useLayoutEffect, useRef } from 'react'
import { t } from '../lib/i18n.js'
import { cx, oneOf, STEPS } from '../lib/ui-kit.js'
import Icon from './Icon.jsx'
import { Spacer } from './layout.jsx'

// The top and bottom of a sheet, as the sheets build them by hand today. For sheets in their own
// files: the ones in sheets.jsx move onto these when it is split.

// The sheet's title. With `onClose` or `action` it shares a row with them, the close button an
// xmark; `sub` is the muted line under it, which describes the dialog (data-sheet-sub: the sheet
// points its aria-describedby at it, lib/use-sheet-dialog.js), so a confirm's question is read out.
export function SheetHeader({ title, sub, onClose, action }) {
  const close = onClose && <button className="iconbtn" aria-label={t('Cancel')} onClick={onClose}><Icon name="xmark" /></button>
  const subLine = sub != null && <div className="muted small mb-5" data-sheet-sub="">{sub}</div>
  if (!close && !action) return <>
    <h3 className={sub != null ? 'mb-1' : undefined}>{title}</h3>
    {subLine}
  </>
  return <>
    <div className={cx('row between', sub != null ? 'mb-1' : 'mb-7')}>
      <h3 className="m-0">{title}</h3>
      {close && action ? <div className="row g-4">{action}{close}</div> : action || close}
    </div>
    {subLine}
  </>
}

// The sheet's buttons, under a 14px spacer and `gap` steps apart (default 4, 8px): the
// spacer-and-button run every sheet ends with. `sticky` pins them to the sheet's bottom edge on a
// hairline, so a long sheet that scrolls keeps its one way on in reach (the workout summary's
// "Nice!"); the 14px above the buttons is the footer's own padding.
export function SheetActions({ gap = 4, sticky = false, children }) {
  oneOf('SheetActions', 'gap', gap, STEPS)
  const buttons = Children.toArray(children).map((child, i) => <Fragment key={i}>
    {i > 0 && <Spacer size={gap} />}
    {child}
  </Fragment>)
  if (sticky) return <StickyFoot>{buttons}</StickyFoot>
  return <>
    <Spacer size={7} />
    {buttons}
  </>
}

// The footer tells the sheet how tall it is (--foot-h, ui-kit.css .sheet:has(> .sheet-foot)), so
// the sheet's scroll-padding clears it when Tab brings a control into view. A custom property set
// on the sheet's element, not a style of the footer's own; it goes with the footer.
function StickyFoot({ children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const foot = ref.current
    const sheet = foot?.parentElement
    if (!foot || !sheet) return
    const measure = () => sheet.style.setProperty('--foot-h', `${Math.ceil(foot.getBoundingClientRect().height)}px`)
    measure()
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    watch?.observe(foot)
    return () => {
      watch?.disconnect()
      sheet.style.removeProperty('--foot-h')
    }
  }, [])
  return <div className="sheet-foot" ref={ref}>{children}</div>
}
