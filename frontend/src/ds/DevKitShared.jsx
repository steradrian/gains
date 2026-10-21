import Section from './DevKitSection.jsx'
import StageNavBar from './StageNavBar.jsx'

// The shared pages' part of the catalogue (DevKit.jsx): the parts the pushed pages (notifications,
// Day, Week) are built from, on the stage with sample data.
const SELF = '#/dev/kit'
const NOOP = () => {}

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
    </>
  )
}
