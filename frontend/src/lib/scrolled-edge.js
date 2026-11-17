// The scroll-edge effect's switch (ds.css "Liquid glass: content layer"): <html data-scrolled> while
// the page is scrolled past its top, so content scrolling under the stage header fades out instead
// of showing crisp behind its glass. One passive listener; the attribute is written only when the
// answer changes, never per frame.

// Modals pins the body while a sheet is open (position fixed, top -y), and scrollY reads 0 then.
export function pageScrollTop(win = window) {
  const y = win.scrollY || 0
  if (y > 0) return y
  const b = win.document.body?.style
  return b && b.position === 'fixed' ? Math.max(0, -(parseFloat(b.top) || 0)) : 0
}

export function setScrolled(el, scrolled) {
  if (el.hasAttribute('data-scrolled') !== scrolled) el.toggleAttribute('data-scrolled', scrolled)
}

export function installScrolledEdge(win = window) {
  const root = win.document.documentElement
  const sync = () => setScrolled(root, pageScrollTop(win) > 0)
  sync()
  win.addEventListener('scroll', sync, { passive: true })
  return () => {
    win.removeEventListener('scroll', sync)
    root.removeAttribute('data-scrolled')
  }
}
