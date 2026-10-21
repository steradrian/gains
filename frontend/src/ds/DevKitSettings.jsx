import SettingsPage from '../views/settings/SettingsPage.jsx'
import ConfirmDrawer from './ConfirmDrawer.jsx'
import DangerRow from './DangerRow.jsx'
import Section from './DevKitSection.jsx'
import LayoutTile from './LayoutTile.jsx'
import StageNote from './StageNote.jsx'

// Settings' part of the catalogue (DevKit.jsx): what the Settings pages stand on. Later milestones
// append a block under "Settings <slice> m<n>".
const NOOP = () => {}

export default function DevKitSettings() {
  return (
    <>
      <Section title="Settings: shell" note="The page frame, the R5 confirm and the destructive row." />

      <Section title="SettingsPage" note="Back, the large title as the page's h1 and a line under it; the body is the page's. Here with a trivial child.">
        <SettingsPage title="Units and language" line="How weights and the app read" parent="#/dev/kit">
          <StageNote>The page body</StageNote>
        </SettingsPage>
      </Section>

      <Section title="ConfirmDrawer" note="The only confirm: what goes, the destructive button first, Cancel under it. With and without the list and the note.">
        <ConfirmDrawer title="Remove this passkey?" body="You will not be able to sign in with it again."
          items={['Pixel 9 · added 3 Oct']} note="Your other passkeys keep working."
          icon="trash" confirmLabel="Remove passkey" onConfirm={NOOP} onCancel={NOOP} />
        <ConfirmDrawer title="Start over?" body="This cannot be undone." confirmLabel="Start over" onConfirm={NOOP} onCancel={NOOP} />
      </Section>

      <Section title="DangerRow" note="A destructive row: it opens a confirm or a page, and deletes nothing itself. The second draws the hairline above.">
        <div className="g-glass">
          <DangerRow title="Start over" sub="Wipes your training data" onClick={NOOP} />
          <DangerRow first={false} icon="warning" title="Delete account" sub="Gone after 7 days" onClick={NOOP} />
        </div>
      </Section>

      {/* Settings train m1 */}
      <Section title="LayoutTile" note="A drawn workout layout you can choose: a radio in a group the caller names. Cards is chosen; List, Compact and Focus are not.">
        <div role="radiogroup" aria-label="Layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, maxWidth: 360 }}>
          <LayoutTile layout="cards" label="Cards" selected onClick={NOOP} />
          <LayoutTile layout="list" label="List" onClick={NOOP} />
          <LayoutTile layout="compact" label="Compact" onClick={NOOP} />
          <LayoutTile layout="focus" label="Focus" onClick={NOOP} />
        </div>
      </Section>
    </>
  )
}
