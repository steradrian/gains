import { useEffect } from 'react'
import { useUI } from '../../store/useUI.js'
import { t } from '../../lib/i18n.js'

/**
 * A search hit: scroll its row (a button, or a stage row found by its `<b>` title) into view and flash it once. A row that shows only
 * once the page has heard back from the server (web push, the passkey list) is waited for a
 * moment; still missing, the hit's `via` row, if it names one, is flashed instead, with a word
 * on why. `body` is the ref of the element the rows are in; `find` the row's English title.
 */
export function useFlashRow(body, find, via) {
  const toast = useUI(s => s.toast)
  useEffect(() => {
    if (!find || !body.current) return
    const el = body.current
    const named = label => [...el.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === label)
      || [...el.querySelectorAll('.g-glist-row, .g-drow')].find(r => r.querySelector('b')?.textContent === label)
      || [...el.querySelectorAll('.set-tiles')].find(g => g.getAttribute('aria-label') === label)
      || [...el.querySelectorAll('.btn')].find(b => b.textContent.trim() === label)
      // Settings shell m2: the stage's rows (GlassList, GlassValueRow, DangerRow) name themselves in a <b>.
      || [...el.querySelectorAll('.g-glist-row, .g-danger-row')].find(r => r.querySelector('b')?.textContent === label)
    let tm = null
    const flash = row => {
      row.classList.add('sp-flash')
      if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' })
      tm = setTimeout(() => row.classList.remove('sp-flash'), 1900)
    }
    const row = named(t(find))
    if (row) { flash(row); return () => clearTimeout(tm) }
    let done = false
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const r = named(t(find))
      if (r && !done) { done = true; mo.disconnect(); clearTimeout(wait); flash(r) }
    }) : null
    mo?.observe(el, { childList: true, subtree: true })
    const wait = setTimeout(() => {
      if (done) return
      done = true; mo?.disconnect()
      const r = via && named(t(via))
      if (r) { flash(r); toast(t('Turn on push notifications first.')) }
    }, 1500)
    return () => { done = true; mo?.disconnect(); clearTimeout(wait); clearTimeout(tm) }
  }, [find])
}
