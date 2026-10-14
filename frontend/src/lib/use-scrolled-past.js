import { useEffect, useState } from 'react'

// True once the element behind `ref` has scrolled up out of view (its bottom above the
// viewport's top plus `topPx`, where a sticky bar sits). False where IntersectionObserver is
// missing: the element then simply counts as visible.
export function useScrolledPast(ref, topPx = 0) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') return undefined
    const io = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < topPx)
    }, { rootMargin: `-${topPx}px 0px 0px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, topPx])
  return past
}
