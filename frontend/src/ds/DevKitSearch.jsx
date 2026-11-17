import { useState } from 'react'
import BestMatch from './BestMatch.jsx'
import Section from './DevKitSection.jsx'
import GoToChips from './GoToChips.jsx'
import ResultChips from './ResultChips.jsx'
import SearchFeatureCard from './SearchFeatureCard.jsx'
import SearchRow from './SearchRow.jsx'
import SearchSection from './SearchSection.jsx'
import StageHeader from './StageHeader.jsx'

// The search's part of the catalogue (DevKit.jsx, "Shared: search"), on the stage with sample data
// held in memory only. English sample copy, like the rest of the workbench.
const SELF = '#/dev/kit'
const NOOP = () => {}
const GOTO = [
  { id: 'history', label: 'History', icon: 'history', href: SELF },
  { id: 'exercises', label: 'Exercises', icon: 'dumbbell', href: SELF },
  { id: 'foods', label: 'Foods', icon: 'apple', href: SELF },
  { id: 'body', label: 'Body', icon: 'scale', href: SELF },
]
const COUNTS = [
  { group: 'exercises', count: 4, text: '4 exercises' }, { group: 'routines', count: 2, text: '2 routines' },
  { group: 'workouts', count: 6, text: '6 workouts' }, { group: 'settings', count: 1, text: '1 setting' },
]
const RECENT = [
  { key: 'q', title: 'press', sub: 'Search', media: { kind: 'glyph', glyph: 'clock' } },
  { key: 'ex', title: 'Bench press', sub: 'Exercise · best set 80 kg × 6', media: { kind: 'glyph', glyph: 'dumbbell' } },
  { key: 'food', title: 'Greek yogurt 2%', sub: 'Your food · 170 g · 120 kcal', media: { kind: 'glyph', glyph: 'apple' } },
  { key: 'day', title: 'Mon 12 Oct', sub: 'Day · Push A, 2,075 kcal', media: { kind: 'date', iso: '2026-10-12' } },
]
const NONE = [
  { key: 'near', title: 'Did you mean “protein bar”?', sub: 'Your food · 60 g · 210 kcal', glyph: 'magnifier' },
  { key: 'food', title: 'Create food “protien bar”', sub: 'Opens the food editor with this name', glyph: 'apple' },
  { key: 'ex', title: 'Create exercise “protien bar”', sub: 'Opens New exercise with this name', glyph: 'dumbbell' },
  { key: 'off', title: 'Search Open Food Facts', sub: 'For “protien bar”, online', glyph: 'globe' },
]

export default function DevKitSearch() {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('Workouts')
  const [kind, setKind] = useState(null)
  const [recent, setRecent] = useState(RECENT)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <Section title="Shared: search · StageHeader searching" note="The pill is the real input: focus it to search, type (the header holds the query), × in the bell's place closes. Then scoped to one kind, a chip in the field.">
        <StageHeader initial="A" unread={2} searching={searching} onSearch={v => { setSearching(v); if (!v) setQuery('') }}
          query={query} onQuery={setQuery} placeholder="Search Gains" onSettings={NOOP} onBell={NOOP} />
        <StageHeader initial="A" searching onSearch={NOOP} query="press" onQuery={NOOP} placeholder="Search training"
          scope={scope || undefined} onClearScope={() => setScope(null)} onSettings={NOOP} />
      </Section>

      <Section title="GoToChips" note="Today and Me; Train and Eat have their own four.">
        <GoToChips items={GOTO} />
      </Section>

      <Section title="SearchSection and SearchRow" note="Recent with × and Clear (Clear empties it here; the app's toast offers Undo); a section with See all.">
        <SearchSection title="Recent" action={recent.length ? 'Clear' : undefined} onAction={() => setRecent([])}>
          {recent.map(r => <SearchRow key={r.key} title={r.title} sub={r.sub} media={r.media} onClick={NOOP} onRemove={() => setRecent(l => l.filter(x => x.key !== r.key))} />)}
        </SearchSection>
        {!recent.length && <SearchSection title="Recent" action="Bring them back" onAction={() => setRecent(RECENT)} card={false} />}
        <SearchSection title="Exercises" action="See all 4" onAction={NOOP}>
          <SearchRow title="Seated shoulder press" ranges={[[16, 21]]} sub="Exercise · shoulders · last 22 kg × 10" media={{ kind: 'glyph', glyph: 'dumbbell' }} onClick={NOOP} />
          <SearchRow title="Leg press" ranges={[[4, 9]]} sub="Exercise · quads · last 160 kg × 10" media={{ kind: 'glyph', glyph: 'dumbbell' }} href={SELF} />
        </SearchSection>
      </Section>

      <Section title="ResultChips" note="Tap one: it lights as the kind shown alone; tap it again for all.">
        <ResultChips items={COUNTS} active={kind} onSelect={g => setKind(k => (k === g ? null : g))} />
      </Section>

      <Section title="BestMatch" note="A glyph; then a page as a link.">
        <BestMatch kind="Exercise" title="Bench press" ranges={[[6, 11]]} sub="Best set 80 kg × 6 · est. 1RM 96 kg" media={{ kind: 'glyph', glyph: 'dumbbell' }} onClick={NOOP} />
        <BestMatch kind="Page" title="History" sub="Training › History" media={{ kind: 'glyph', glyph: 'history' }} href={SELF} />
      </Section>

      <Section title="SearchFeatureCard" note="Turn on holds for a second here, as while the switch is written.">
        <SearchFeatureCard title="Fasting" ranges={[[0, 4]]} icon="timer" pageTitle="Features" busy={busy}
          line="A timer for your fasts with a goal and history. It is off in Features, so Eat doesn’t show it."
          onTurnOn={() => { setBusy(true); setTimeout(() => setBusy(false), 1000) }} onOpenPage={NOOP} />
      </Section>

      <Section title="Nothing matches: the ways on" note="SearchRow with a glyph; the heading above them is StageEmpty (Train's kit).">
        <SearchSection>
          {NONE.map(a => <SearchRow key={a.key} title={a.title} sub={a.sub} media={{ kind: 'glyph', glyph: a.glyph }} onClick={NOOP} />)}
        </SearchSection>
      </Section>
    </>
  )
}
