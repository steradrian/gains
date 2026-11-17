import { t } from '../lib/i18n.js'
import Button from '../ds/Button.jsx'
import GlassList from '../ds/GlassList.jsx'
import IconButton from '../ds/IconButton.jsx'
import { SheetHeader } from './sheet-layout.jsx'
import '../signin.css'

// "Having trouble?" over the sign-in screen after a passkey did not go through (S0.3): what a
// passkey needs, and the two other ways in. `onPassword` is absent where the instance takes none.
// A drawer in the app's sheet; the design system's tokens apply inside the .g-root.
export default function SigninTroubleSheet({ close, onCode, onPassword }) {
  const items = [
    { icon: 'smartphone', title: t('Use a code from your other device'), sub: t('Your other device gets you in, then this one gets its own passkey'), onClick: onCode },
    onPassword && { icon: 'lock', title: t('Sign in with password'), sub: t('If you set one earlier'), onClick: onPassword },
  ].filter(Boolean)
  return (
    <div className="g-root">
      <SheetHeader title={t('Having trouble?')} action={<IconButton icon="xmark" label={t('Close')} tone="tonal" onClick={close} />} />
      <p className="si-sheet-text">{t('Passkeys need Safari or Chrome, with Face ID, Touch ID or a screen lock turned on. Some apps open links in their own browser, which can’t save one.')}</p>
      <GlassList tone="light" items={items} />
      <div className="si-sheet-close"><Button variant="secondary" block onClick={close}>{t('Close')}</Button></div>
    </div>
  )
}
