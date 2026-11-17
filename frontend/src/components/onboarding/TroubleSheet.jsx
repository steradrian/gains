import Button from '../../ds/Button.jsx'
import IconButton from '../../ds/IconButton.jsx'
import { copyText } from '../../lib/clipboard.js'
import { t } from '../../lib/i18n.js'
import { openInBrowserLabel } from '../../lib/open-in-browser.js'
import { pathOf } from '../../lib/onboarding/flow.js'
import { useUI } from '../../store/useUI.js'
import { SheetHeader } from '../sheet-layout.jsx'

// "Having trouble?" after a passkey prompt was cancelled or could not open (board O2.1t): what a
// passkey needs, and the link to open in a real browser (an in-app browser cannot save one). The
// board's content in the app's own sheet; the design system's tokens apply inside the .g-root.

// The invite's own link, the one the inviter sent: the hub's /join/<code> page opens it in the app.
// The address on screen is the name step, which has no code in it: opened elsewhere it would be
// the same invite landing nowhere. Without a code (opened by hand), the address is all there is.
export default function TroubleSheet({ close, code }) {
  const copy = async () => {
    const link = code ? `${window.location.origin}${pathOf('invite', code)}` : window.location.href
    const ok = await copyText(link).then(() => true, () => false)
    close()
    useUI.getState().toast(ok ? t('Link copied') : t('Could not copy the link'))
  }
  return (
    <div className="g-root">
      <SheetHeader title={t('Having trouble?')} action={<IconButton icon="xmark" label={t('Close')} tone="tonal" onClick={close} />} />
      <p className="ob-sheet-text">{t('Passkeys need Safari or Chrome, with Face ID, Touch ID or a screen lock turned on. Some apps open links in their own browser, which can’t save one.')}</p>
      <Button block onClick={copy}>{openInBrowserLabel()}</Button>
      <div className="ob-sheet-close"><Button variant="secondary" block onClick={close}>{t('Close')}</Button></div>
    </div>
  )
}
