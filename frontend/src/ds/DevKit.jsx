import { useState } from 'react'
import Button from './Button.jsx'
import CodeCells from './CodeCells.jsx'
import Section from './DevKitSection.jsx'
import DevKitDrawers from './DevKitDrawers.jsx'
import DevKitPushed from './DevKitPushed.jsx'
import DevKitShared from './DevKitShared.jsx'
import DevKitToday from './DevKitToday.jsx'
import DevKitTrain from './DevKitTrain.jsx'
import GlassActions from './GlassActions.jsx'
import GlassList from './GlassList.jsx'
import GlassTabBar from './GlassTabBar.jsx'
import IconButton from './IconButton.jsx'
import Illustration from './Illustration.jsx'
import InlineBanner from './InlineBanner.jsx'
import Logo from './Logo.jsx'
import OnboardingNav from './OnboardingNav.jsx'
import RingCarousel from './RingCarousel.jsx'
import StageAlert from './StageAlert.jsx'
import StageChoiceCard from './StageChoiceCard.jsx'
import StageDayCount from './StageDayCount.jsx'
import StageFooter from './StageFooter.jsx'
import StageHeader from './StageHeader.jsx'
import StageRing from './StageRing.jsx'
import StageScreen, { ACCENTS } from './StageScreen.jsx'
import StageWeekMarks from './StageWeekMarks.jsx'
import StageWeekStrip from './StageWeekStrip.jsx'
import SuccessCheck from './SuccessCheck.jsx'
import TextField from './TextField.jsx'
import { SCENE_NAMES } from './illustration-scenes.js'
import './dev-kit.css'

// Every design-system component in every variant, on the stage, with sample data and no network:
// #/dev/kit on the dev server (App.jsx; production builds leave it out). A workbench for people
// building screens, so its sample copy is English and not translated.
const SELF = '#/dev/kit'
const GOALS = [
  { icon: 'scale', title: 'Lose weight', sub: 'A steady deficit, protein kept high' },
  { icon: 'dumbbell', title: 'Build muscle', sub: 'A small surplus and progressive training' },
  { icon: 'target', title: 'Stay where I am', sub: 'Maintenance calories' },
]
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const NOOP = () => {}
const RINGS = [
  { name: 'Calories', top: 'Left today', big: '1,240', unit: 'kcal of 2,100', value: 860, max: 2100, pill: '860 eaten', icon: 'flame' },
  { name: 'Protein', top: 'Protein left', big: '9', unit: 'g of 150 g', value: 141, max: 150, pill: '141 g eaten', icon: 'utensils' },
  { name: 'Carbs', top: 'Carbs left', big: '120', unit: 'g of 230 g', value: 110, max: 230, pill: '110 g eaten', icon: 'utensils' },
  { name: 'Fat', top: 'Fat left', big: '30', unit: 'g of 70 g', value: 40, max: 70, pill: '40 g eaten', icon: 'utensils' },
]
const FOOD_ACTIONS = [
  { icon: 'utensils', label: 'Log food', onClick: NOOP },
  { icon: 'scanBarcode', label: 'Scan', onClick: NOOP },
  { icon: 'droplet', label: 'Water', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
]
const TRAINING_ACTIONS = [
  { icon: 'play', label: 'Start', onClick: NOOP },
  { icon: 'chartLine', label: 'Activity', onClick: NOOP },
  { icon: 'scale', label: 'Weigh-in', onClick: NOOP },
  { icon: 'calendar', label: 'Plan', href: SELF },
]
const WEEK_MARKS = [
  ['M', 'Monday', 'done'], ['T', 'Tuesday', 'rest'], ['W', 'Wednesday', 'missed'], ['T', 'Thursday', 'today'],
  ['F', 'Friday', 'planned'], ['S', 'Saturday', 'rest'], ['S', 'Sunday', 'planned'],
].map(([dow, day, state]) => ({ key: day, dow, state, label: day + ', ' + state }))

export default function DevKit() {
  const [accent, setAccent] = useState('cobalt')
  const [step, setStep] = useState(3)
  const [goal, setGoal] = useState(1)
  const [code, setCode] = useState('A7K')
  const [invalid, setInvalid] = useState(false)
  const [replay, setReplay] = useState(0)
  const [alerts, setAlerts] = useState(1)
  const [days, setDays] = useState(4)
  const [searching, setSearching] = useState(false)
  const [page, setPage] = useState(0)

  return (
    <StageScreen accent={accent}>
      <OnboardingNav step={step} onBack={() => setStep(s => Math.max(1, s - 1))} onSkip={() => setStep(s => Math.min(8, s + 1))} />
      <div className="g-kit">
        <Section title="Accent" note="The design system's presets, on the StageScreen's data-accent.">
          <div className="g-kit-row">
            {ACCENTS.map(a => <Button key={a} variant="secondary" size="sm" aria-pressed={a === accent} onClick={() => setAccent(a)}>{a}</Button>)}
          </div>
        </Section>

        <Section title="OnboardingNav" note="Callbacks (above, step it with Back and Skip), links, a custom skip label, and the empty ends.">
          <OnboardingNav backHref={SELF} step={5} skipHref={SELF} />
          <OnboardingNav onBack={() => {}} step={2} total={4} onSkip={() => {}} skipLabel="Not now" />
          <OnboardingNav onBack={() => {}} />
          <OnboardingNav step={8} />
        </Section>

        <Section title="Logo">
          <div className="g-kit-row g-kit-white">
            <Logo size={56} />
            <Logo variant="mark" size={40} />
            <Logo variant="wordmark" size={28} />
            <Logo variant="mark" size={20} />
          </div>
        </Section>

        <Section title="Illustration" note="tone stage, draw once per session; Replay draws them again (draw, replayKey).">
          <div className="g-kit-row"><Button variant="secondary" size="sm" icon="reset" onClick={() => setReplay(r => r + 1)}>Replay</Button></div>
          {SCENE_NAMES.map(name => <Illustration key={name} name={name} tone="stage" draw={replay ? true : 'once'} replayKey={replay} width={260} />)}
        </Section>

        <Section title="StageChoiceCard" note="icon and sub, selected, slim, a link.">
          <div className="g-kit-col">
            {GOALS.map((g, i) => <StageChoiceCard key={g.title} {...g} selected={goal === i} onClick={() => setGoal(i)} />)}
          </div>
          <div className="g-kit-col">
            <StageChoiceCard slim title="Female" selected />
            <StageChoiceCard slim title="Male" />
            <StageChoiceCard slim title="Rather not say" href={SELF} />
          </div>
          <div className="g-kit-col" role="radiogroup" aria-label="Goal, as radios">
            {GOALS.map((g, i) => <StageChoiceCard key={g.title} radio {...g} selected={goal === i} tabIndex={goal === i ? 0 : -1} onClick={() => setGoal(i)} />)}
          </div>
        </Section>

        <Section title="StageDayCount and StageWeekStrip" note="0 to 6 keys (pick one: the week lights those days); 0 lights none.">
          <StageDayCount values={[0, 1, 2, 3, 4, 5, 6]} value={days} onPick={n => setDays(n)} labelOf={n => (n === 0 ? '0, just tracking food' : undefined)} />
          <StageWeekStrip days={WEEK.map((label, i) => ({ key: label, label, lit: i < days }))} />
        </Section>

        <Section title="TextField" note="tone stage, with a unit and a hint.">
          <TextField tone="stage" label="Your name" placeholder="First name" />
          <TextField tone="stage" label="Target weight" defaultValue="78.5" unit="kg" inputMode="decimal" hint="You can change it any time in Me" />
        </Section>

        <Section title="CodeCells" note="Letters are uppercased, anything else dropped; invalid draws them amber.">
          <CodeCells value={code} onChange={setCode} invalid={invalid} />
          <div className="g-kit-row"><Button variant="secondary" size="sm" aria-pressed={invalid} onClick={() => setInvalid(v => !v)}>Invalid</Button></div>
          <CodeCells length={4} numeric label="Reset code" />
          <CodeCells length={12} label="Device code" />
        </Section>

        <Section title="IconButton" note="glass on the stage; none, tonal and accent on a light surface.">
          <div className="g-kit-row">
            <IconButton icon="chevronLeft" label="Back" tone="glass" />
            <IconButton icon="xmark" label="Close" tone="glass" />
          </div>
          <div className="g-kit-light">
            <div className="g-kit-row">
              <IconButton icon="more" label="Card options" />
              <IconButton icon="xmark" label="Close" tone="tonal" />
              <IconButton icon="scanBarcode" label="Scan for Lunch" tone="accent" />
            </div>
          </div>
        </Section>

        <Section title="Button" note="On a light surface; the stage's white button and plain link are in StageFooter below.">
          <div className="g-kit-light">
            <div className="g-kit-row">
              <Button>Save weigh-in</Button>
              <Button variant="secondary">Edit</Button>
              <Button variant="ghost">See changes</Button>
              <Button variant="danger" icon="trash">Delete</Button>
            </div>
            <div className="g-kit-row">
              <Button size="sm" icon="plus">Add to Lunch</Button>
              <Button size="sm" variant="secondary" iconRight="chevronRight">Next</Button>
              <Button disabled>Start Push A</Button>
              <Button href={SELF} variant="secondary">A link</Button>
            </div>
            <Button block>Add to Lunch</Button>
            <Illustration name="plan" draw="once" width={220} />
            <TextField label="Serving" defaultValue="150" unit="g" inputMode="decimal" />
          </div>
        </Section>

        <Section title="StageAlert" note="One glass line of bad news with an action chip; key it per failure and it shakes and takes focus again.">
          <div className="g-kit-row"><Button variant="secondary" size="sm" onClick={() => setAlerts(n => n + 1)}>Fail again</Button></div>
          <StageAlert key={alerts} action="Having trouble?" onAction={() => {}}>Your passkey could not be confirmed.</StageAlert>
          <StageAlert icon="warning">Without a chip, as one line.</StageAlert>
        </Section>

        <Section title="InlineBanner" note="Stage glass; on a light surface in accent, warning and muted; a title alone; with actions.">
          <InlineBanner stage title="That code didn’t work" body="It is wrong, already used or expired. Make a new one on your other device." />
          <div className="g-kit-light">
            <InlineBanner tone="warning" title="Wrong name, e-mail or password." body="Check both, or use a reset code from your admin." />
            <InlineBanner tone="warning" title="This account has been disabled." />
            <InlineBanner tone="accent" title="Coach has a plan" body="Review it before it starts." actions={[{ label: 'Review', solid: true, onClick: () => {} }, { label: 'Later', onClick: () => {} }]} />
            <InlineBanner tone="muted" icon="clock" title="Rest day" />
          </div>
        </Section>

        <Section title="GlassList" note="Rows in one card: with a chevron when they go somewhere, without when they only say something; light in a drawer.">
          <GlassList items={[
            { icon: 'smartphone', title: 'Where is the code?', sub: 'On your other device: Settings › Account' },
            { icon: 'lock', title: 'Sign in with password', sub: 'If you set one in Settings › Account', onClick: () => {} },
          ]} />
          <div className="g-kit-light">
            <GlassList tone="light" items={[
              { icon: 'smartphone', title: 'Use a code from your other device', sub: 'Your other device gets you in', onClick: () => {} },
              { icon: 'lock', title: 'Sign in with password', onClick: () => {} },
            ]} />
          </div>
        </Section>

        <DevKitToday />
        <DevKitTrain />
        <DevKitDrawers />

        <Section title="GlassTabBar" note="Tap it (the first lights what is tapped, and the pill glides); then a running workout on Train, no tab lit, and over a light page.">
          <div className="g-kit-col">
            <GlassTabBar onPlus={NOOP} />
            <GlassTabBar current="train" running onChange={NOOP} onPlus={NOOP} />
            <GlassTabBar current={null} onChange={NOOP} onPlus={NOOP} />
          </div>
          <div className="g-kit-light">
            <GlassTabBar current="eat" hrefs={{ today: SELF, train: SELF, eat: SELF, me: SELF, plus: SELF }} />
          </div>
        </Section>

        <Section title="StageWeekMarks" note="The training profile's week: done, missed, today, planned and rest; then every day a button.">
          <div className="g-kit-col">
            <StageWeekMarks days={WEEK_MARKS} />
            <StageWeekMarks days={WEEK_MARKS.map(d => ({ ...d, onClick: NOOP }))} />
          </div>
        </Section>

        <Section title="SuccessCheck" note="The ring draws itself once as the screen arrives.">
          <div className="g-kit-row"><SuccessCheck /></div>
        </Section>

        <Section title="StageHeader" note="Avatar, search pill and bell. The first is controlled (search it: the bell turns into the close); then links, and a count of twelve.">
          <StageHeader initial="A" unread={3} searching={searching} onSearch={setSearching} onSettings={NOOP} onBell={NOOP} />
          <StageHeader initial="M" placeholder="Search training" settingsHref={SELF} searchHref={SELF} bellHref={SELF} />
          <StageHeader initial="S" placeholder="Search food" unread={12} onSettings={NOOP} onBell={NOOP} />
        </Section>

        <Section title="StageRing" note="Progress, over target (amber, 180 kcal over 2,100), five digits (one step smaller), a custom size, and loading.">
          <div className="g-kit-row">
            <StageRing value={860} max={2100} top="Left today" big="1,240" unit="kcal of 2,100" />
            <StageRing value={2100} max={2100} over={180 / 2100} top="Over today" big="180" unit="kcal over 2,100" />
          </div>
          <div className="g-kit-row">
            <StageRing value={12000} max={30000} top="Steps left" big="18,000" unit="of 30,000" />
            <StageRing value={3} max={5} top="This week" big="3" unit="of 5 workouts" size={160} stroke={12} />
          </div>
          <div className="g-kit-row"><StageRing loading /></div>
        </Section>

        <Section title="RingCarousel" note={`Swipe or use the dots. Page shown: ${page + 1}. Then one ring alone (no dots), and loading.`}>
          <RingCarousel slides={RINGS} onChange={setPage} onOpen={NOOP} />
          <RingCarousel slides={[{ name: 'Workouts', top: 'This week', big: '3', unit: 'of 5', value: 3, max: 5, href: SELF }]} />
          <RingCarousel loading />
        </Section>

        <Section title="GlassActions" note="Food profile, training profile, three actions, and loading.">
          <GlassActions items={FOOD_ACTIONS} />
          <GlassActions items={TRAINING_ACTIONS} />
          <GlassActions items={FOOD_ACTIONS.slice(0, 3)} />
          <GlassActions loading />
        </Section>

        <Section title="StageFooter" note="In the flow (sticky false) with a note; the screen's own is pinned to the bottom.">
          <StageFooter sticky={false} note="Gains is invite-only. New here? Open the invite link a friend sent you.">
            <Button block icon="scanFace">Sign in with passkey</Button>
            <Button block variant="glass" icon="smartphone">Use a code from your other device</Button>
            <Button block variant="ghost" href={SELF}>Sign in with password</Button>
          </StageFooter>
          <StageFooter sticky={false}>
            <Button block busy>Waiting for your passkey</Button>
            <Button block variant="ghost">Cancel</Button>
          </StageFooter>
        </Section>

        <DevKitShared />
        <DevKitPushed />
      </div>
      <StageFooter>
        <Button block onClick={() => setStep(s => Math.min(8, s + 1))}>Continue</Button>
        <Button block variant="ghost" onClick={() => setStep(1)}>Start again</Button>
      </StageFooter>
    </StageScreen>
  )
}
