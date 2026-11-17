/* What the screen and the drawers are measuring, live, for a bug report from a device (Settings ›
   About, admins only). The drawer band on the installed iPhone app (lib/sheet-keyboard.js
   viewportShortfall) shows here as innerHeight and the fixed box ending short of screen.height.
   Read-only: it measures, it never writes.

   `probe` is a hidden fixed box with `inset: 0` (the same box #modal-root is), padded by the
   resolved --sat/--sab, holding three children: one padded by env() alone, one 100dvh tall and one
   100lvh tall (setting-rows.css .set-vp-probe). The labels are the names the code uses, not prose,
   and stay as they are in every language. */

const px = n => (Number.isFinite(n) ? `${Math.round(n * 10) / 10}` : '–')
const rect = r => (r ? `${px(r.top)}..${px(r.bottom)} (${px(r.height)})` : '–')
const prop = (el, name) => el?.style?.getPropertyValue(name).trim() || 'unset'

export function readViewport(win, probe) {
  const doc = win.document
  const html = doc.documentElement
  const vv = win.visualViewport
  const cs = el => (el ? win.getComputedStyle(el) : null)
  const resolved = cs(probe)
  const [envBox, dvh, lvh] = probe ? [...probe.children].map(cs) : []
  const modalRoot = doc.getElementById('modal-root')
  const standalone = win.matchMedia?.('(display-mode: standalone)').matches
  return [
    ['innerHeight × innerWidth', `${px(win.innerHeight)} × ${px(win.innerWidth)}`],
    ['visualViewport.height', px(vv?.height)],
    ['visualViewport.offsetTop', px(vv?.offsetTop)],
    ['screen.height × screen.width', `${px(win.screen?.height)} × ${px(win.screen?.width)}`],
    ['100dvh / 100lvh', `${dvh ? px(parseFloat(dvh.height)) : '–'} / ${lvh ? px(parseFloat(lvh.height)) : '–'}`],
    ['env(safe-area-inset-top / bottom)', envBox ? `${px(parseFloat(envBox.paddingTop))} / ${px(parseFloat(envBox.paddingBottom))}` : '–'],
    ['--sat / --sab', resolved ? `${px(parseFloat(resolved.paddingTop))} / ${px(parseFloat(resolved.paddingBottom))}` : '–'],
    ['--vvh', prop(html, '--vvh')],
    ['--kb', prop(html, '--kb')],
    ['--vp-short', prop(html, '--vp-short')],
    ['position: fixed; inset: 0', rect(probe?.getBoundingClientRect())],
    ['#modal-root', modalRoot ? rect(modalRoot.getBoundingClientRect()) : 'closed'],
    ['display-mode standalone', standalone ? 'yes' : 'no'],
    ['navigator.standalone', String(win.navigator?.standalone ?? '–')],
  ]
}
