import CheerList from './CheerList.jsx'
import MemberAvatar, { MEMBER_TONES, memberTone } from './MemberAvatar.jsx'
import MemberRing from './MemberRing.jsx'
import MomentRow from './MomentRow.jsx'
import SharedBar from './SharedBar.jsx'
import Section from './DevKitSection.jsx'

// Friends' part of the catalogue (DevKit.jsx): the parts the Groups pages are built from, on the
// stage with sample members. Later Friends milestones append their own parts below (MomentRow,
// SharedBar).

const INITIALS = ['A', 'M', 'R', 'I', 'V']
const WEEK = [
  { value: 4, of: 4, tone: 'mint' },
  { value: 4, of: 5, tone: 'sky' },
  { value: 5, of: 5, tone: 'iris' },
  { value: 2, of: 4, tone: 'amber' },
  { value: 2, of: 4, tone: 'sage' },
]

export default function DevKitFriends() {
  return (
    <>
      <Section title="Friends" note="The parts of a group: a member's initial, and the one ring a group fills together." />

      <Section title="MemberAvatar" note="An initial in a circle, three sizes, and every tone: glass (the stage's own) then the five per-person colours, none of them red. With a label it is an image with a spoken name; without, it is decoration.">
        <div className="g-kit-row">
          {['sm', 'md', 'lg'].map(size => <MemberAvatar key={size} initial="A" size={size} tone="mint" />)}
        </div>
        <div className="g-kit-row">
          {MEMBER_TONES.map((tone, i) => <MemberAvatar key={tone} initial={INITIALS[i % INITIALS.length]} tone={tone} />)}
        </div>
        <div className="g-kit-row">
          <MemberAvatar initial="Mara" tone="sky" label="Mara" />
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
        <MemberRing size={120} stroke={12} label="Just you: 3 of 4" segments={[{ value: 3, of: 4, tone: 'glass' }]} />
        <MemberRing size={120} stroke={12} segments={[]} />
        <MemberRing size={120} stroke={12} label="A week with no plan for two members" segments={[
          { value: 0, of: 0, tone: 'mint' }, { value: 3, of: 3, tone: 'sky' }, { value: 0, of: 0, tone: 'iris' },
        ]} />
      </Section>

      {/* Friends group m1 */}
      <Section title="MomentRow" note="A moment in a group: initials, an optional tag (NEW BEST, Target reached), title, detail and when, and a Cheer pill that turns to a still white Cheered. Your own moment has no pill; Trained together stacks two initials and has a ⋯.">
        <ul className="g-mlist g-glass">
          <MomentRow people={[{ uid: 'm', initial: 'M', tone: 'sky' }]} title="Mara finished Legs" detail="54 min · 6 exercises" time="2 hours ago" cheerLabel="Cheer Mara finished Legs" />
          <MomentRow people={[{ uid: 'a', initial: 'A', tone: 'mint' }, { uid: 'i', initial: 'I', tone: 'amber' }]} title="You and Ioana trained together" detail="Push A, same evening" time="yesterday" cheered onMore={() => {}} moreLabel="Options" />
          <MomentRow people={[{ uid: 'r', initial: 'R', tone: 'iris' }]} kind="NEW BEST" title="Radu set a new best" detail="Deadlift" time="yesterday" cheerLabel="Cheer Radu set a new best" />
          <MomentRow people={[{ uid: 'a', initial: 'A', tone: 'mint' }]} title="You finished Pull A" detail="48 min" time="Fri" mine />
        </ul>
      </Section>

      {/* Friends surfaces m1 */}
      <Section title="CheerList" note="This week's cheers in one glass card: the sender's initial in their colour, what they cheered, a line of detail and when. Plain information, not tappable.">
        <CheerList label="Cheers this week" rows={[
          { key: 'a', initial: 'Mara', tone: 'sky', text: 'Mara cheered your Push A', detail: 'Sunday evening', when: '2 h ago' },
          { key: 'b', initial: 'Radu', tone: 'iris', text: 'Radu cheered your new best Cable fly', detail: '20 kg x 12', when: 'Yesterday' },
          { key: 'c', initial: 'Iron Sunday', tone: 'glass', text: 'Everyone cheered the week', detail: 'Goal hit · 4 weeks in a row', when: '3 days ago' },
        ]} />
      </Section>

      {/* Friends challenge m1 */}
      <Section title="SharedBar" note="One bar a group fills together: a segment per person in join order, each as long as their own count of the goal, in their own colour. Never sorted, never red; past the goal it is full and never says over. The fill grows in and stands still under reduced motion.">
        <SharedBar goal={15} label="12 of 15 workouts" segments={[
          { value: 3, tone: 'mint' }, { value: 3, tone: 'sky' }, { value: 2, tone: 'iris' }, { value: 3, tone: 'amber' }, { value: 1, tone: 'sage' },
        ]} />
        <SharedBar goal={9} label="Three people, 6 of 9" segments={[{ value: 3, tone: 'mint' }, { value: 2, tone: 'sky' }, { value: 1, tone: 'iris' }]} />
        <SharedBar goal={9} label="Nothing counted yet" segments={[]} />
        <SharedBar goal={6} label="Goal reached" segments={[{ value: 3, tone: 'mint' }, { value: 3, tone: 'sky' }]} />
      </Section>
    </>
  )
}
