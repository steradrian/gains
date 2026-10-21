import { useEffect } from 'react'

/* The sheets' keyboard handling (the lift over the soft keyboard) is global now:
   lib/sheet-keyboard.js. What stays here is the sideways chip strips and the keyboard-safe
   tappable. */

/* Chip strips scroll sideways, and a filter set from code ("★ Chosen", a reset) can land the
   active chip off-screen. Pull it into view along the strip only. This used to be
   scrollIntoView({block:'nearest'}), which also walks every scrollable ancestor: with the
   strip scrolled above the fold (Library, halfway down the list) a tap on a chip made the
   whole page jump up to show the row — the "swiping the chips scrolls the page" bug. Setting
   the strip's own scrollLeft cannot move anything but the strip.

   `pad` mirrors scroll-padding-inline in index.css so a revealed chip is not glued to the edge. */
export function revealChip(strip, chip, pad = 16) {
  if (!strip || !chip || typeof strip.getBoundingClientRect !== 'function' || typeof chip.getBoundingClientRect !== 'function') return false
  const s = strip.getBoundingClientRect(), c = chip.getBoundingClientRect()
  const width = strip.clientWidth || s.width || 0
  if (!width) return false
  const left = c.left - s.left + (strip.scrollLeft || 0)   // chip's offset inside the strip's content
  const right = left + c.width
  let next = strip.scrollLeft || 0
  if (left - pad < next) next = Math.max(0, left - pad)
  else if (right + pad > next + width) next = right + pad - width
  if (next === (strip.scrollLeft || 0)) return false
  strip.scrollLeft = next
  return true
}

// The same for the design system's ChipGroup (`scroll`), which holds no ref of its own: `wrapRef` is
// the element around it.
export function useRevealActiveGroupChip(wrapRef, active) {
  useEffect(() => {
    const strip = wrapRef.current?.querySelector?.('.g-cgroup-scroll')
    const chip = strip?.querySelector?.('.g-cchip.on')
    if (chip) revealChip(strip, chip)
  }, [wrapRef, active])
}

export function useRevealActiveChip(stripRef, active) {
  useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.querySelector?.('.chip.on')
    if (chip) revealChip(strip, chip)
  }, [stripRef, active])
}

/* Props that make a clickable <div> behave like a button for keyboard and screen-reader
   users. Kept as a div because some rows nest a real <Button> (Library), and a button inside
   a button is invalid HTML. Space is swallowed so the page does not scroll under the row. */
export function tappable(onClick) {
  if (!onClick) return {}
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: e => {
      if (e.target !== e.currentTarget) return   // a nested control handles its own keys
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick(e)
      }
    }
  }
}
