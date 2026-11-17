import { t } from './i18n.js'

// The label of the button that copies the app's link to open it in a real browser (an in-app
// browser cannot save a passkey): the phone's own, Chrome on Android and Safari on iOS (an iPad
// says Macintosh, with touch).
export function openInBrowserLabel() {
  const ua = navigator.userAgent
  if (/Android/.test(ua)) return t('Copy link to open in Chrome')
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return t('Copy link to open in Safari')
  return t('Copy link to open in your browser')
}
