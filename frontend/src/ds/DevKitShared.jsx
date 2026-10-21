import Section from './DevKitSection.jsx'
import InlineBanner from './InlineBanner.jsx'
import NotificationGroup from './NotificationGroup.jsx'
import NotificationRow from './NotificationRow.jsx'
import StageEmpty from './StageEmpty.jsx'
import StageNavBar from './StageNavBar.jsx'
import StageNote from './StageNote.jsx'
import StageSection from './StageSection.jsx'

// The shared pages' part of the catalogue (DevKit.jsx): the parts the pushed pages (notifications,
// Day, Week) are built from, on the stage with sample data.
const SELF = '#/dev/kit'
const NOOP = () => {}
// A colourless stand-in for an exercise still (the UI guards allow no colour literal in source).
const STILL = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52"><rect x="8" y="32" width="36" height="6" rx="3" fill-opacity=".35"/><rect x="16" y="14" width="20" height="14" rx="3" fill-opacity=".22"/></svg>')

export default function DevKitShared() {
  return (
    <>
      <Section title="Shared: pages" note="The parts pushed pages stand on: the stage nav bar, and the notifications page's rows, headings, empty state and banner." />

      <Section title="StageNavBar" note="Back and a title; a Back named for where it goes; Back and one action; two actions at the end (the title stays centred); a long title; no title (the large title sits below); a link Back.">
        <StageNavBar title="Notifications" onBack={NOOP} />
        <StageNavBar title="Mon 19 Oct" onBack={NOOP} backLabel="Back to Train" />
        <StageNavBar title="Notifications" onBack={NOOP} actions={[{ icon: 'gear', label: 'Reminder settings', onClick: NOOP }]} />
        <StageNavBar title="Week" onBack={NOOP} actions={[
          { icon: 'chevronLeft', label: 'Previous week', onClick: NOOP },
          { icon: 'chevronRight', label: 'Next week', onClick: NOOP },
        ]} />
        <StageNavBar title="Monday 19 October, a long day with a long title" onBack={NOOP} actions={[{ icon: 'gear', label: 'Day settings', onClick: NOOP }]} />
        <StageNavBar onBack={NOOP} actions={[{ icon: 'gear', label: 'Reminder settings', href: SELF }]} />
        <StageNavBar title="From a link" backHref={SELF} />
      </Section>

      <Section title="StageSection variants" note="line: a status with a glass pill (2 new, Mark all read), then the read state as plain text; label: the small heading over a group.">
        <StageSection variant="line" title="2 new" action="Mark all read" onAction={NOOP} />
        <StageSection variant="line" title="All read" action="Nothing unread" />
        <StageSection variant="label" title="New" />
      </Section>

      <Section title="NotificationRow" note="One row per kind: new (lit, bold, the dot, a spoken New), read, a new best with the exercise still, a reminder with its own glyph, a link, a long title and line, and with only a title.">
        <NotificationGroup title="New">
          <NotificationRow kind="coach" isNew title="Coach moved Legs to Mon 19 Oct" body="It wasn’t logged on Fri 16 Oct. Pull A moves to Wed 21 Oct." when="Coach · 2 h ago" onClick={NOOP} />
          <NotificationRow kind="best" isNew image={STILL} title="New best: Bench press" body="Est. 1RM 96 kg, up 4 kg in four weeks." when="New best · Mon 12 Oct, 19:24" onClick={NOOP} />
        </NotificationGroup>
        <NotificationGroup title="This week">
          <NotificationRow kind="streak" title="6 weeks on plan" body="Every planned workout done or moved, six weeks running. Your best is 8." when="Streak · Sun 11 Oct" onClick={NOOP} />
          <NotificationRow kind="recap" title="Your week, 5 to 11 Oct" body="3 of 4 workouts · 6 of 7 days on target · −0.4 kg" when="Weekly recap · Sun 11 Oct" href={SELF} />
          <NotificationRow kind="reminder" icon="scale" title="Time to weigh in" body="Your 08:00 reminder. Last weigh-in 81.7 kg." when="Reminder you set · Sun 11 Oct" onClick={NOOP} />
        </NotificationGroup>
        <NotificationGroup title="Earlier">
          <NotificationRow kind="reminder" icon="lucideDumbbell" title="Workout today: Push A" body="Your 18:00 reminder." when="Reminder you set · Mon 5 Oct" onClick={NOOP} />
          <NotificationRow kind="milestone" title="50 workouts" body="Since you started on 3 Jun." when="Milestone · Fri 2 Oct" onClick={NOOP} />
          <NotificationRow kind="coach" isNew title="A very long title that has to wrap onto a second line without pushing the dot out" body="And a line of detail that is just as long, to see the row grow and the dot stay at the top." when="Coach · Fri 2 Oct" onClick={NOOP} />
          <NotificationRow kind="milestone" title="Only a title" onClick={NOOP} />
        </NotificationGroup>
      </Section>

      <Section title="StageEmpty on the notifications page" note="Nothing yet (Sh3Empty): the bell disc, the title, the line and the one white button, bare on the stage.">
        <StageEmpty card={false} icon="bell" title="Nothing new" body="Reminders you set, streaks and new bests show up here." action="Set a reminder" onClick={NOOP} />
      </Section>

      <Section title="Permission banner" note="Notifications off on this phone (Sh3PermOff): an InlineBanner on the stage with a solid Turn on and a Reminders link, in the page's gutter.">
        <div className="g-sbanner">
          <InlineBanner stage icon="bellSlash" title="Notifications are off on this phone" body="They still land here, but your phone won’t buzz. On iPhone, add Gains to the Home Screen first."
            actions={[{ label: 'Turn on', solid: true, onClick: NOOP }, { label: 'Reminders', href: SELF }]} />
        </div>
      </Section>

      <Section title="StageNote" note="The fine print at the foot of a pushed page.">
        <StageNote>Kept for 30 days. The reminders you set live in Me › Reminders.</StageNote>
      </Section>
    </>
  )
}
