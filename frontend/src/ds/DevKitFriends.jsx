import CheerList from './CheerList.jsx'
import MemberAvatar, { MEMBER_TONES, memberTone } from './MemberAvatar.jsx'
import MemberRing from './MemberRing.jsx'
import Section from './DevKitSection.jsx'

// Friends' part of the catalogue (DevKit.jsx): the parts the Groups pages are built from, on the
// stage with sample members. Later Friends milestones append their own parts below (MomentRow,
// SharedBar).

const INITIALS = ['A', 'M', 'R', 'I', 'V']
const WEEK = [
  { value: 4, of: 4, tone: 'mint' },
  { value: 4, of: 5, tone: 'blue' },
  { value: 5, of: 5, tone: 'purple' },
  { value: 2, of: 4, tone: 'orange' },
  { value: 2, of: 4, tone: 'green' },
]

export default function DevKitFriends() {
  return (
    <>
      <Section title="Friends" note="The parts of a group: a member's initial, and the one ring a group fills together." />

      <Section title="MemberAvatar" note="An initial in a circle, three sizes, and every tone: white (the stage's glass) then the five per-person colours, none of them red. With a label it is an image with a spoken name; without, it is decoration.">
        <div className="g-kit-row">
          {['sm', 'md', 'lg'].map(size => <MemberAvatar key={size} initial="A" size={size} tone="mint" />)}
        </div>
        <div className="g-kit-row">
          {MEMBER_TONES.map((tone, i) => <MemberAvatar key={tone} initial={INITIALS[i % INITIALS.length]} tone={tone} />)}
        </div>
        <div className="g-kit-row">
          <MemberAvatar initial="Mara" tone="blue" label="Mara" />
        </div>
        <span className="g-mavatars">
          {INITIALS.map((initial, i) => <MemberAvatar key={initial} initial={initial} tone={memberTone(i)} />)}
        </span>
      </Section>

      <Section title="MemberRing" note="A segment per member in join order, each filling by their own share with their own colour; never sorted, never red. With one member it is a plain ring, with none only the track; the centre is a slot.">
        <MemberRing label="17 of 22 sessions this week" segments={WEEK}>
          <b>17</b>
          <span>of 22 sessions</span>
        </MemberRing>
        <MemberRing size={120} stroke={12} label="Just you: 3 of 4" segments={[{ value: 3, of: 4, tone: 'white' }]} />
        <MemberRing size={120} stroke={12} segments={[]} />
        <MemberRing size={120} stroke={12} label="A week with no plan for two members" segments={[
          { value: 0, of: 0, tone: 'mint' }, { value: 3, of: 3, tone: 'blue' }, { value: 0, of: 0, tone: 'purple' },
        ]} />
      </Section>

      {/* Friends surfaces m1 */}
      <Section title="CheerList" note="This week's cheers in one glass card: the sender's initial in their colour, what they cheered, a line of detail and when. Plain information, not tappable.">
        <CheerList label="Cheers this week" rows={[
          { key: 'a', initial: 'Mara', tone: 'blue', text: 'Mara cheered your Push A', detail: 'Sunday evening', when: '2 h ago' },
          { key: 'b', initial: 'Radu', tone: 'purple', text: 'Radu cheered your new best Cable fly', detail: '20 kg x 12', when: 'Yesterday' },
          { key: 'c', initial: 'Iron Sunday', tone: 'white', text: 'Everyone cheered the week', detail: 'Goal hit · 4 weeks in a row', when: '3 days ago' },
        ]} />
      </Section>
    </>
  )
}
