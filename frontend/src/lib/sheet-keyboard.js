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

/* The keyboard's reach up the layout viewport, and the height left above it. */
export function sheetKeyboardInsets(win) {
  const viewport = win.visualViewport
  const native = nativeKeyboardHeight(win.document)
  const vh = Math.max(0, viewport?.height || win.innerHeight)
  const visualBottom = (viewport?.offsetTop || 0) + vh
  const bottomInset = Math.max(0, win.innerHeight - visualBottom, native)
  const visualHeight = Math.max(0, Math.min(vh, win.innerHeight - native))
  return { bottomInset, visualHeight }
}

/* Writes the two variables (and data-kb) when they changed. Returns the insets it applied. */
export function applySheetKeyboard(win, root = win.document.documentElement) {
  const { bottomInset, visualHeight } = sheetKeyboardInsets(win)
  root.style.setProperty('--kb', `${bottomInset}px`)
  if (bottomInset > 0) {
    root.style.setProperty('--vvh', `${visualHeight}px`)
    root.setAttribute('data-kb', '')
  } else {
    root.style.removeProperty('--vvh')
    root.removeAttribute('data-kb')
  }
  return { bottomInset, visualHeight }
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
    const key = `${bottomInset}/${visualHeight}`
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
