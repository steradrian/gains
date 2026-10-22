import { useState } from 'react'
import { LOOKS, lookLabel } from '../lib/stage-look/index.js'
import SettingsPage from '../views/settings/SettingsPage.jsx'
import { Card, SegmentedRow, SwitchRow } from '../views/settings/pages/prefs-rows.jsx'
import AccentPicker from './AccentPicker.jsx'
import ConfirmDrawer from './ConfirmDrawer.jsx'
import DangerRow from './DangerRow.jsx'
import Section from './DevKitSection.jsx'
import LayoutTile from './LayoutTile.jsx'
import LookTile from './LookTile.jsx'
import StageNote from './StageNote.jsx'
import StageSlider from './StageSlider.jsx'

// Settings' part of the catalogue (DevKit.jsx): what the Settings pages stand on. Later milestones
// append a block under "Settings <slice> m<n>".
const NOOP = () => {}

export default function DevKitSettings() {
  const [accent, setAccent] = useState('cobalt')
  const [look, setLook] = useState('linen')
  const [intensity, setIntensity] = useState(0.45)
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
        <div role="radiogroup" aria-label="Layout" className="g-ltile-grid">
          <LayoutTile layout="cards" label="Cards" selected onClick={NOOP} />
          <LayoutTile layout="list" label="List" onClick={NOOP} />
          <LayoutTile layout="compact" label="Compact" onClick={NOOP} />
          <LayoutTile layout="focus" label="Focus" onClick={NOOP} />
        </div>
      </Section>

      {/* Settings prefs m1 */}
      <Section title="Settings prefs m1: rows with a control" note="A card of rows whose control is the only thing to tap: a switch (the last one disabled, as AI Coach is while it is coming soon) and a segmented control.">
        <Card>
          <SwitchRow icon="timer" title="Fasting" sub="Adds Fast to the + sheet, with a timer and history." checked={false} onChange={NOOP} />
          <SwitchRow icon="chat" title="AI Coach" sub="Coming soon" checked={false} disabled onChange={NOOP} />
          <SegmentedRow icon="scale" title="Weight unit" sub="Sets, weigh-ins, plates"
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value="kg" onChange={NOOP} />
        </Card>
      </Section>

      {/* Settings look m1 */}
      <Section title="Settings: look" note="The Appearance and Background pages' controls." />

      <Section title="AccentPicker" note="The 28 themes as a radio group, five to a row; the check marks the lit one. Arrow keys move the choice.">
        <AccentPicker value={accent} onChange={setAccent} label="Accent color" haptic={false} />
      </Section>

      <Section title="LookTile" note="A still preview of a look in the current accent at the slider's strength; Classic is the CSS stage. Without WebGL the gradient stays.">
        <div className="g-lgrid" role="radiogroup" aria-label="Background">
          {LOOKS.map(id => (
            <LookTile key={id} look={id} accent={accent} intensity={intensity} label={lookLabel(id)} selected={id === look}
              onSelect={setLook} haptic={false} />
          ))}
        </div>
      </Section>

      <Section title="StageSlider" note="Quiet to Bold. onChange previews while the thumb moves; onCommit writes once on release.">
        <StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={intensity} onChange={setIntensity} haptic={false} />
      </Section>
    </>
  )
}
