import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react'
import { REDUCED, SURFACE_EXIT, SURFACE_SPRING } from '../../lib/motion.js'
import { useDsAccent } from '../../lib/use-ds-accent.js'
import { StageArt } from '../../ds/StageBackground.jsx'
import { SEARCH_OVERLAY_ID, useSearch } from '../../lib/search/session.js'
import SearchPanel from './SearchPanel.jsx'
import { useReducedMotionPref } from './use-reduced-motion.js'
import { useSearchData } from './use-search-data.js'

// The overlay (owner direction for PR-07, the bearmenu search overlay): a results panel only, fixed
// under the pinned header from its bottom edge to the window's, on the stage, with its own
// scroller (search.css .search-ov). The header's field is the one input and stays where it is;
// the panel alone comes and goes on bearmenu's surface spring: the panel fades where it stands (so
// its top edge never leaves the header's) and its scroller rises 8px inside it (SearchPanel
// SCROLL_RISE); opacity alone under reduced motion. Loaded lazily by SearchHost, which holds the
// page behind it.
const SURFACE = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: SURFACE_SPRING },
  exit: { opacity: 0, transition: SURFACE_EXIT },
}
const SURFACE_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: REDUCED },
  exit: { opacity: 0, transition: REDUCED },
}

export default function SearchOverlay() {
  const open = useSearch(s => s.open)
  const accent = useDsAccent()
  const reduced = useReducedMotionPref()
  return <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <AnimatePresence>
        {open && <m.div key="search" className="g-root search-ov" data-accent={accent} id={SEARCH_OVERLAY_ID}
          variants={reduced ? SURFACE_REDUCED : SURFACE} initial="hidden" animate="visible" exit="exit">
          <div className="search-ov-bg"><StageArt /></div>
          <LivePanel />
        </m.div>}
      </AnimatePresence>
    </MotionConfig>
  </LazyMotion>
}

function LivePanel() {
  return <SearchPanel data={useSearchData(true)} />
}

/** The same panel standing still, on the data it is given: the screens gallery's
 *  (dev/screens/states/shared-search.jsx), which holds every state open. */
export function SearchSurface({ data }) {
  const accent = useDsAccent()
  return <LazyMotion features={domAnimation}>
    <div className="g-root search-ov" data-accent={accent} id={SEARCH_OVERLAY_ID}>
      <div className="search-ov-bg"><StageArt /></div>
      <SearchPanel data={data} />
    </div>
  </LazyMotion>
}
