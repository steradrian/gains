import { useState } from 'react'
import Button from './Button.jsx'
import CodeCells from './CodeCells.jsx'
import Section from './DevKitSection.jsx'
import IconButton from './IconButton.jsx'
import Illustration from './Illustration.jsx'
import Logo from './Logo.jsx'
import OnboardingNav from './OnboardingNav.jsx'
import StageChoiceCard from './StageChoiceCard.jsx'
import StageFooter from './StageFooter.jsx'
import StageScreen, { ACCENTS } from './StageScreen.jsx'
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

export default function DevKit() {
  const [accent, setAccent] = useState('cobalt')
  const [step, setStep] = useState(3)
  const [goal, setGoal] = useState(1)
  const [code, setCode] = useState('A7K')
  const [invalid, setInvalid] = useState(false)
  const [replay, setReplay] = useState(0)

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
        </Section>

        <Section title="TextField" note="tone stage, with a unit and a hint.">
          <TextField tone="stage" label="Your name" placeholder="First name" />
          <TextField tone="stage" label="Target weight" defaultValue="78.5" unit="kg" inputMode="decimal" hint="You can change it any time in Me" />
        </Section>

        <Section title="CodeCells" note="Letters are uppercased, anything else dropped; invalid draws them amber.">
          <CodeCells value={code} onChange={setCode} invalid={invalid} />
          <div className="g-kit-row"><Button variant="secondary" size="sm" aria-pressed={invalid} onClick={() => setInvalid(v => !v)}>Invalid</Button></div>
          <CodeCells length={4} numeric label="Reset code" />
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

        <Section title="StageFooter" note="In the flow (sticky false) with a note; the screen's own is pinned to the bottom.">
          <StageFooter sticky={false} note="Gains is invite-only. New here? Open the invite link a friend sent you.">
            <Button block icon="scanFace">Sign in with passkey</Button>
            <Button block variant="ghost" href={SELF}>Sign in with password</Button>
          </StageFooter>
        </Section>
      </div>
      <StageFooter>
        <Button block onClick={() => setStep(s => Math.min(8, s + 1))}>Continue</Button>
        <Button block variant="ghost" onClick={() => setStep(1)}>Start again</Button>
      </StageFooter>
    </StageScreen>
  )
}
