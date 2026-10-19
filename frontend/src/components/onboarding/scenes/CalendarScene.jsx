import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from '../../../lib/reduced-motion.js'
import { cx } from '../../../lib/ui-kit.js'
import StageArt from '../StageArt.jsx'

// 3b Born: a tear-off calendar (the kit's `birthday` scene). The year in HTML on the page, never
// the age; the band lights once there is a year. On a change the old page tears off (up 6, tilt
// -4, fade, 220ms), one at a time while the wheel spins.
export default function CalendarScene({ year, after }) {
  const [page, setPage] = useState(null)
  const shown = useRef(year)
  useEffect(() => {
    const old = shown.current
    shown.current = year
    if (old == null || year == null || old === year || reducedMotion()) return undefined
    setPage(p => p ?? { year: old, id: Date.now() })
    const timer = setTimeout(() => setPage(null), 220)
    return () => clearTimeout(timer)
  }, [year])
  return <StageArt name="birthday" width={260} className={cx('ob-born', year != null && 'set')} after={after}
    overlay={year != null && <div className="ob-cal-yr" aria-hidden="true">
      <span className="ob-cal-v">{year}</span>
      {page && <span key={page.id} className="ob-cal-pg">{page.year}</span>}
    </div>} />
}
