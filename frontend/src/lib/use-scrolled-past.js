import { useCallback, useEffect, useState } from 'react'

// Where the pinned tab-root header ends (ds.css .g-shdr-pin: its row, the status bar and the
// connection row), measured from the element itself rather than worked out from the CSS, whose
// --sat is an unresolved max(env(…)) to getComputedStyle.
const PINNED = '.g-shdr-pin'
const bottomOf = el => (el ? Math.max(0, el.getBoundingClientRect().bottom) : 0)

/**
 * [ref, past]: `past` is true once the element given to `ref` has scrolled up under the pinned
 * header (or to the window's top on a page without one). The header is measured, and measured
 * again when it changes height (the connection row coming and going). `ref` is a callback ref, so
 * an element that mounts later (a card that waits for its data) is observed when it appears, and a
 * replaced one is swapped. False where IntersectionObserver is missing: the element then counts as
 * visible.
 */
export function useScrolledPast() {
  const [node, setNode] = useState(null)
  const [past, setPast] = useState(false)
  const [top, setTop] = useState(0)
  const ref = useCallback(el => setNode(el), [])

  useEffect(() => {
    if (!node || typeof document === 'undefined') return undefined
    const header = document.querySelector(PINNED)
    const measure = () => setTop(Math.round(bottomOf(header)))
    measure()
    if (!header || typeof ResizeObserver !== 'function') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    return () => ro.disconnect()
  }, [node])

  useEffect(() => {
    if (!node || typeof IntersectionObserver !== 'function') { setPast(false); return undefined }
    const io = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < top)
    }, { rootMargin: `-${top}px 0px 0px 0px` })
    io.observe(node)
    return () => io.disconnect()
  }, [node, top])
  return [ref, past]
}
