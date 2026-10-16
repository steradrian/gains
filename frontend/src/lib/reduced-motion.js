// Whether the app keeps still: the device's own "reduce motion" setting, or Profile › Appearance ›
// Reduce motion (App.jsx marks the root with data-motion="reduce"). index.css applies the same
// rule to both; anything that animates from script asks here.

/** The device's setting alone. */
export function systemReducesMotion() {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/** The device's setting or the app's switch. */
export function reducedMotion() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'reduce') return true
  return systemReducesMotion()
}

/**
 * Calls `cb` when the app is told to keep still while it runs: the device's setting turned on or
 * the app's switch did. For what must stop mid-flight (a thread, a transition); everything else
 * asks `reducedMotion()` when it starts. Returns the unsubscribe.
 */
export function onReducedMotion(cb) {
  const fire = () => { if (reducedMotion()) cb() }
  let mq = null
  try { mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null } catch { mq = null }
  mq?.addEventListener?.('change', fire)
  const mo = typeof MutationObserver === 'function' && typeof document !== 'undefined' ? new MutationObserver(fire) : null
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
  return () => {
    mq?.removeEventListener?.('change', fire)
    mo?.disconnect()
  }
}
