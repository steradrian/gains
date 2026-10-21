import { useLayoutEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { t } from '../lib/i18n.js'
import { reducedMotion } from '../lib/reduced-motion.js'
import { cx } from '../lib/ui-kit.js'
import Act from './Act.jsx'
import StageRing from './StageRing.jsx'

const SKELETON_PAGES = 4

// The hero of Today (bundle.js `RingCarousel`, boards T10Today and T12Protein): one StageRing per
// number the person tracks, a glass pill under it, swiped with scroll-snap. The dots sit outside
// the scroller so they stay put, and are buttons (the bundle's sit inside each slide's link, where
// nothing can focus them). `onChange(index)` is called when the page shown changes, by swipe, by
// a dot, or by focusing a slide with the keyboard. A slide is a link with its `href` (or the
// carousel's), a button otherwise, and `onOpen(slide, index)` fires either way. Each slide:
// { name, top, big, unit, value, max, over, pill, icon, href }; `name` ("Protein") is what a
// screen reader hears before the numbers. `start` is the first page shown. `loading` draws the
// skeleton the boards show (T11Loading): a ring, a pill and the dots, `slides` only sets how many.
export default function RingCarousel({ slides = [], start = 0, onOpen, onChange, href, label, loading }) {
  const n = slides.length
  const pages = loading ? slides.length || SKELETON_PAGES : n
  const first = Math.min(Math.max(start, 0), Math.max(n - 1, 0))
  const [shown, setActive] = useState(first)
  // The profile can change how many rings there are under a mounted carousel
  const active = Math.min(shown, Math.max(n - 1, 0))
  const scroller = useRef(null)
  // Where a dot sent the scroller, so the pages it passes on the way are not reported.
  const heading = useRef(null)
  const groupLabel = label || t('Today at a glance')

  useLayoutEffect(() => {
    const el = scroller.current
    if (el && first > 0) el.scrollLeft = first * el.clientWidth * direction(el)
  }, [first])

  if (loading) {
    return (
      <div className="g-rcb" role="group" aria-label={groupLabel} aria-busy="true">
        <div className="g-rc-slide">
          <StageRing loading />
          <i className="g-skel g-rc-sk-pill" />
        </div>
        <Dots count={pages} active={0} />
      </div>
    )
  }

  const settle = i => {
    setActive(i)
    onChange?.(i)
  }

  const onScroll = () => {
    const el = scroller.current
    if (!el || !el.clientWidth) return
    const i = Math.min(n - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / el.clientWidth)))
    if (heading.current !== null) {
      if (i !== heading.current) return
      heading.current = null
    }
    if (i !== active) settle(i)
  }

  const goTo = i => {
    const el = scroller.current
    if (!el || i === active) return
    heading.current = i
    el.scrollTo({ left: i * el.clientWidth * direction(el), behavior: reducedMotion() ? 'auto' : 'smooth' })
  }
  // The person took over (a touch, a wheel or trackpad) or the glide ended short of the dot's
  // page: report where it is now instead of waiting for a page it may never reach.
  const release = () => { heading.current = null }
  const onScrollEnd = () => { release(); onScroll() }

  return (
    <div className="g-rcb" role="group" aria-label={groupLabel}>
      <div className="g-rc" ref={scroller} onScroll={onScroll} onScrollEnd={onScrollEnd} onPointerDown={release} onTouchStart={release} onWheel={release}>
        {slides.map((s, i) => (
          <Act
            key={i}
            href={s.href || href}
            onClick={() => onOpen?.(s, i)}
            ariaLabel={s.name ? t('{0}: {1}. Open details', s.name, spoken(s)) : undefined}
            className="g-rc-slide"
          >
            <StageRing value={s.value} max={s.max} over={s.over} top={s.top} big={s.big} unit={s.unit} />
            {s.pill && (
              <span className="g-rc-pill g-glass">
                <Icon name={s.icon || 'flame'} className="g-icon" />
                {s.pill}
                <Icon name="chevronRight" className="g-icon" />
              </span>
            )}
          </Act>
        ))}
      </div>
      <Dots count={n} active={active} onPick={goTo} />
    </div>
  )
}

// What a slide says, as its face reads: the line over the number, the number, the line under it,
// then the pill ("Left today 1,240 of 2,100 kcal, 860 eaten"). The label replaces the content
// for a screen reader, so nothing on the face is left out.
function spoken(s) {
  const ring = [s.top, s.big, s.unit].filter(Boolean).join(' ')
  return s.pill ? t('{0}, {1}', ring, s.pill) : ring
}

// scrollLeft runs negative in a right-to-left page
const direction = el => (getComputedStyle(el).direction === 'rtl' ? -1 : 1)

function Dots({ count, active, onPick }) {
  if (count < 2) return null
  return (
    <div className="g-rc-dots">
      {Array.from({ length: count }, (_, k) => onPick
        ? (
          <button key={k} type="button" className="g-rc-dot" aria-label={t('Page {0} of {1}', k + 1, count)} aria-current={k === active ? 'true' : undefined} onClick={() => onPick(k)}>
            <i className={cx(k === active && 'on')} />
          </button>
        )
        : <span key={k} className="g-rc-dot" aria-hidden="true"><i className={cx(k === active && 'on')} /></span>)}
    </div>
  )
}
