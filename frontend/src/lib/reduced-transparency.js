// Whether the app draws solid surfaces instead of glass: the device's own "reduce transparency"
// setting, or Profile › Appearance › Reduce transparency (App.jsx marks the root with
// data-transparency="reduce"). iOS WebKit may not report the media query, hence the app switch.
export const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)'

/** The device's setting alone. */
export function systemReducesTransparency() {
  try { return typeof matchMedia === 'function' && matchMedia(REDUCED_TRANSPARENCY_QUERY).matches } catch { return false }
}

/** The device's setting or the app's switch. */
export function reducedTransparency() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.transparency === 'reduce') return true
  return systemReducesTransparency()
}

/** Calls `cb` when either input changes. Returns the unsubscribe. */
export function onReducedTransparencyChange(cb) {
  let mq = null
  try { mq = typeof matchMedia === 'function' ? matchMedia(REDUCED_TRANSPARENCY_QUERY) : null } catch { mq = null }
  mq?.addEventListener?.('change', cb)
  const mo = typeof MutationObserver === 'function' && typeof document !== 'undefined' ? new MutationObserver(cb) : null
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-transparency'] })
  return () => {
    mq?.removeEventListener?.('change', cb)
    mo?.disconnect()
  }
}
