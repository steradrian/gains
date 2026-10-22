import Button from './Button.jsx'
import InviteRow from './InviteRow.jsx'
import Section from './DevKitSection.jsx'
import StageSection from './StageSection.jsx'
import Tag from './Tag.jsx'

// Me > Invite a friend's part of the catalogue (DevKit.jsx, under "Me invite M2").
const NOOP = () => {}

export default function DevKitMeInvite() {
  return (
    <>
    <Section title="InviteRow" note="A name and the line under it. A whole-row button when the row opens something (a Waiting invite's menu); a card with its own Button when the action is the point (New invite, New link); a Tag for what just happened.">
      <StageSection variant="label" title="Asked" />
      <div className="g-kit-col">
        <InviteRow title="Dana" line="My training partner Andrei"
          trailing={<Button size="sm" variant="glass" onClick={NOOP}>New invite</Button>} />
      </div>
      <StageSection variant="label" title="Waiting" />
      <div className="g-kit-col">
        <InviteRow title="Andrei" line="Waiting · created now · link copied" trailing={<Tag tone="glass">New</Tag>} onClick={NOOP} />
        <InviteRow title="Mara" line="Waiting · expires Thu 22 Oct" onClick={NOOP} />
      </div>
      <StageSection variant="label" title="Joined" action="2" />
      <div className="g-kit-col">
        <InviteRow title="Radu" line="Joined Mon 5 Oct" />
      </div>
      <StageSection variant="label" title="Expired" />
      <div className="g-kit-col">
        <InviteRow title="Vlad" line="Expired Mon 12 Oct" trailing={<Button size="sm" variant="glass" onClick={NOOP}>New link</Button>} />
        <InviteRow title="Invite E5F6…" line="Expired Mon 12 Oct" trailing={<Button size="sm" variant="glass" onClick={NOOP}>New link</Button>} />
      </div>
    </Section>
    {/* Me invite M3: a member's open ask is the same row with Withdraw at its end. */}
    <Section title="InviteRow, a member's open ask" note="The note and the day it was asked; Withdraw is the row's one action and the row leaves when it is taken.">
      <StageSection variant="label" title="Your open asks" />
      <div className="g-kit-col">
        <InviteRow title="My training partner Andrei" line="Asked Thu 22 Oct"
          trailing={<Button size="sm" variant="glass" onClick={NOOP}>Withdraw</Button>} />
      </div>
    </Section>
    </>
  )
}
