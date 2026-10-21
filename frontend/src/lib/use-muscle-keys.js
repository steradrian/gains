import { useRef, useState } from 'react'
import { t } from './i18n.js'
import { MUSCLES, MUSCLE_NAME } from './muscles.js'

const focusVisible = el => { try { return el.matches(':focus-visible') } catch { return true } }

/**
 * The keyboard way into a muscle map whose muscles are buttons (components/BodyMap.jsx with
 * `onMuscle`, ds/BodyMap.jsx with `onMuscle` and a `label`): one tab stop for the whole map, not
 * one per path. A muscle is drawn in up to 16 paths (the obliques), 116 in all, and each was a stop
 * of its own, named the same. Each muscle drawn has one focusable path, its first in the first of
 * `views` that draws it, and one of those holds the stop at a time, the picked muscle's to start
 * with. The arrow keys walk the muscles in MUSCLES order (left and right mirrored right to left),
 * Home and End go to the ends, Enter and Space pick.
 *
 * `g` is the body's geometry (lib/body-paths.js), null until it lands. Returns `box`, the ref for
 * the element that holds the views; `keysFor(slug, view, i)`, the props that make path `i` of the
 * muscle in that view its button (null for every other path); and `ring`, the muscle the keyboard
 * is on, whose every path draws the focus ring.
 */
export function useMuscleKeys({ g, views, selected, onMuscle }) {
  const box = useRef(null)
  const [stop, setStop] = useState(null)
  const [ring, setRing] = useState(null)
  const drawn = g ? MUSCLES.filter(slug => views.some(v => g[v]?.p[slug]?.length)) : []
  const current = drawn.includes(stop) ? stop : drawn.includes(selected) ? selected : drawn[0]
  const onKeyDown = (event, slug) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (event.key === ' ') event.preventDefault()
      onMuscle(slug)
      return
    }
    const rtl = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 1, ArrowUp: -1 }[event.key]
    const n = drawn.length
    const at = step ? (drawn.indexOf(slug) + step + n) % n : event.key === 'Home' ? 0 : event.key === 'End' ? n - 1 : -1
    if (at < 0) return
    event.preventDefault()
    setStop(drawn[at])
    box.current?.querySelector(`[data-muscle="${drawn[at]}"][tabindex]`)?.focus()
  }
  const keysFor = (slug, v, i) => {
    if (i !== 0 || views.find(x => g[x]?.p[slug]?.length) !== v) return null
    return {
      role: 'button',
      tabIndex: slug === current ? 0 : -1,
      'aria-label': t(MUSCLE_NAME[slug]),
      'aria-pressed': selected === slug,
      onKeyDown: event => onKeyDown(event, slug),
      onFocus: event => { setStop(slug); setRing(focusVisible(event.currentTarget) ? slug : null) },
      onBlur: () => setRing(null),
    }
  }
  return { box, keysFor, ring }
}
