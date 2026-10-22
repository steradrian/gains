import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../../lib/i18n.js'
import { readViewport } from '../../../lib/viewport-readout.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'

// About › Viewport (admins only): the screen's and the drawers' measurements, live, so a band or a
// gap seen on a phone can be screenshotted with its numbers. Follows the visual viewport and the
// window, and reads again every second for what changes without an event (a keyboard put away).
export default function ViewportReadout() {
  const probe = useRef(null)
  const [rows, setRows] = useState([])
  useEffect(() => {
    const read = () => setRows(readViewport(window, probe.current))
    read()
    const vv = window.visualViewport
    vv?.addEventListener('resize', read)
    vv?.addEventListener('scroll', read)
    window.addEventListener('resize', read)
    const every = window.setInterval(read, 1000)
    return () => {
      vv?.removeEventListener('resize', read)
      vv?.removeEventListener('scroll', read)
      window.removeEventListener('resize', read)
      window.clearInterval(every)
    }
  }, [])
  return (
    <>
      <StageSection variant="label" title={t('Viewport')} />
      <div className="g-glist g-glass set-vp">
        {rows.map(([label, value]) => <SettingRow key={label} title={label} value={value} />)}
      </div>
      <StageNote>{t('Live screen measurements for a bug report. Only admins see this.')}</StageNote>
      {/* On <body>: inside the page, a transformed or filtered ancestor would be its fixed box. */}
      {createPortal(
        <span ref={probe} className="set-vp-probe" aria-hidden="true">
          <span className="set-vp-env" /><span className="set-vp-dvh" /><span className="set-vp-lvh" />
        </span>,
        document.body,
      )}
    </>
  )
}
