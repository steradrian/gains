import { copyText } from '../../lib/clipboard.js'
import { t } from '../../lib/i18n.js'
import { useUI } from '../../store/useUI.js'
import { SheetActions, SheetHeader } from '../sheet-layout.jsx'
import { Button } from '../ui.jsx'

// "Having trouble?" after a passkey prompt was cancelled or could not open: what a passkey needs,
// and the link to open in a real browser (an in-app browser cannot save one).
export default function TroubleSheet({ close }) {
  const copy = async () => {
    const ok = await copyText(window.location.href).then(() => true, () => false)
    close()
    useUI.getState().toast(ok ? t('Link copied') : t('Could not copy the link'))
  }
  return <>
    <SheetHeader title={t('Having trouble?')} />
    <p className="ob-sheet-p">{t('Passkeys need Safari or Chrome, with Face ID, Touch ID or a screen lock turned on. Some apps open links in their own browser, which can’t save one.')}</p>
    <SheetActions>
      <Button variant="primary" onClick={copy}>{t('Copy link to open in Safari')}</Button>
      <Button onClick={close}>{t('Close')}</Button>
    </SheetActions>
  </>
}
