import StageNote from '../../../ds/StageNote.jsx'
import { confirmDrawer } from '../../../views/settings/confirm-drawer.js'
import SettingsPage from '../../../views/settings/SettingsPage.jsx'
import { registerScreens } from '../registry.js'

// Settings shell (PR-06 shell-m1): the page frame and the R5 confirm, over a placeholder page. The
// wording is the remove-passkey confirm acct-m1 builds (board St2RemovePasskey); the real pages
// come with their own milestones. Nothing here is stored.
const NOOP = () => {}
const Placeholder = () => (
  <SettingsPage title="Account and data" line="Passkeys, devices and your data">
    <StageNote>A Settings page draws here.</StageNote>
  </SettingsPage>
)

registerScreens('Settings', [
  { id: 'A0.page', title: 'Settings page frame', note: 'Back, the large title as the h1, a line under it, then the body.', render: () => <Placeholder /> },
  { id: 'A2.2.shell', title: 'Remove passkey (confirm)', note: 'R5: what goes, the danger button first, Cancel under it. The scrim, Escape and Back cancel.', render: () => <Placeholder />,
    play: async t => {
      confirmDrawer({
        title: 'Remove this passkey?',
        body: 'You will not be able to sign in with it again.',
        items: ['Pixel 9 · added 3 Oct'],
        note: 'Your other passkeys keep working.',
        icon: 'trash',
        confirmLabel: 'Remove passkey',
        onConfirm: NOOP,
      })
      await t.wait(300)
    } },
])
