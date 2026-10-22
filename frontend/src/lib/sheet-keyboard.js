import { nativeKeyboardHeight, NATIVE_KEYBOARD_EVENT } from './native-keyboard.js'

/* Where the soft keyboard is, for every sheet and drawer at once (ds.css, index.css).

   Position the sheet, never resize its box. A drawer used to take `top` and `bottom`, so lifting
   its bottom edge off the keyboard also shortened it, and on iOS the page showed, un-dimmed,
   between the drawer and the keyboard's accessory bar. Now the sheet keeps its height and stands
   on the keyboard (`bottom: var(--kb)`), capped to what is left above it (`max-height` from
   `--vvh`); its body scrolls if that is tight.

   Two numbers, both on <html>:
   --kb   how far the keyboard reaches up the layout viewport, in px
   --vvh  the height of what the keyboard leaves, in px (only while --kb is above 0; the sheets
          fall back to 100dvh otherwise)
   and data-kb on <html> while --kb is above 0 (the safe-area padding at a drawer's foot goes:
   the keyboard covers the home indicator).

   iOS does not resize the layout viewport for the keyboard. It shrinks the visual viewport and,
   to keep the focused field visible, scrolls the layout viewport under it (`offsetTop`), so the
   part of the layout viewport that is still in view runs from offsetTop to offsetTop + height.
   Whatever sits below that is the keyboard's. On Android 15 the visual viewport does not shrink
   either (edge to edge): the app passes the keyboard as --native-kb (lib/native-keyboard.js) and
   the larger of the two wins. Android Chrome's default (`interactive-widget=resizes-visual`; the
   viewport meta in index.html does not set it) behaves like iOS here. */

/* Nothing shorter than this is a keyboard. An installed iOS PWA can report a visual viewport a
   status bar's height (~59px) shorter than `innerHeight` with no keyboard up; read as a keyboard
   it lifted every drawer off the bottom edge, with the page showing in the gap. (The band seen on
   device is the viewport itself ending short: viewportShortfall, below.) */
export const KEYBOARD_MIN_PX = 120

/* The keyboard's reach up the layout viewport, and the height left above it. */
export function sheetKeyboardInsets(win) {
  const viewport = win.visualViewport
  const native = nativeKeyboardHeight(win.document)
  const vh = Math.max(0, viewport?.height || win.innerHeight)
  const visualBottom = (viewport?.offsetTop || 0) + vh
  const visualInset = Math.max(0, win.innerHeight - visualBottom)
  const bottomInset = Math.max(visualInset >= KEYBOARD_MIN_PX ? visualInset : 0, native)
  const visualHeight = Math.max(0, Math.min(vh, win.innerHeight - native))
  return { bottomInset, visualHeight }
}

/* How far short of the screen the layout viewport ends, in an installed iOS app (WebKit bug 301994
   and its kin). Once a keyboard has been up, innerHeight, the visual viewport and 100dvh can all
   stay a status bar's height short (932 → 873 on a 15 Pro Max) for the rest of the session: every
   fixed box ends that far above the screen's edge and WebKit fills the strip below with the page's
   background. In an installed app the window is the whole screen, so the screen's height (its long
   side, held upright) is what innerHeight should be. 0 anywhere else: in Safari, Android and the
   native shells the screen is more than the window. A shortfall a keyboard's size is not this. */
export function viewportShortfall(win) {
  if (win.navigator?.standalone !== true || !win.screen) return 0
  const { width, height } = win.screen
  const full = win.innerHeight >= win.innerWidth ? Math.max(width, height) : Math.min(width, height)
  const short = Math.round(full - win.innerHeight)
  return short > 0 && short < KEYBOARD_MIN_PX ? short : 0
}

/* Writes the variables (and data-kb) when they changed. Returns what it applied.
   --vp-short is viewportShortfall: a drawer's foot leaves out that much of the bottom safe-area
   inset, which then sits in the strip below the viewport, out of the drawer's way (ds.css .g-bs,
   index.css .sheet). The strip itself takes the drawer's colour (components/Modals.jsx). */
export function applySheetKeyboard(win, root = win.document.documentElement) {
  const { bottomInset, visualHeight } = sheetKeyboardInsets(win)
  const short = viewportShortfall(win)
  root.style.setProperty('--kb', `${bottomInset}px`)
  if (bottomInset > 0) {
    root.style.setProperty('--vvh', `${visualHeight}px`)
    root.setAttribute('data-kb', '')
  } else {
    root.style.removeProperty('--vvh')
    root.removeAttribute('data-kb')
  }
  if (short > 0) root.style.setProperty('--vp-short', `${short}px`)
  else root.style.removeProperty('--vp-short')
  return { bottomInset, visualHeight, short }
}

/* Installed once at start-up (main.jsx). Follows the visual viewport (resize: the keyboard opening,
   closing or the device turning; scroll: iOS moving the layout viewport under it), the window
   (rotation), the Android 15 keyboard event, and focus changes, where iOS can raise the keyboard a
   frame before any of those land. Returns the cleanup. */
export function startSheetKeyboard(win = typeof window !== 'undefined' ? window : null) {
  if (!win?.document?.documentElement) return () => {}
  const viewport = win.visualViewport
  let last = ''
  const sync = () => {
    const { bottomInset, visualHeight } = sheetKeyboardInsets(win)
    const key = `${bottomInset}/${visualHeight}/${viewportShortfall(win)}`
    if (key === last) return
    last = key
    applySheetKeyboard(win)
  }
  // Focus moves are followed by the keyboard a beat later; ask again once it has settled.
  const settle = () => {
    sync()
    ;(win.requestAnimationFrame || (f => setTimeout(f, 16)))(sync)
    setTimeout(sync, 350)
  }
  sync()
  viewport?.addEventListener('resize', sync)
  viewport?.addEventListener('scroll', sync)
  win.addEventListener('resize', sync)
  win.addEventListener('orientationchange', settle)
  win.addEventListener(NATIVE_KEYBOARD_EVENT, sync)
  win.document.addEventListener('focusin', settle)
  win.document.addEventListener('focusout', settle)
  return () => {
    viewport?.removeEventListener('resize', sync)
    viewport?.removeEventListener('scroll', sync)
    win.removeEventListener('resize', sync)
    win.removeEventListener('orientationchange', settle)
    win.removeEventListener(NATIVE_KEYBOARD_EVENT, sync)
    win.document.removeEventListener('focusin', settle)
    win.document.removeEventListener('focusout', settle)
  }
}
