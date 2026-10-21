import { t } from '../../lib/i18n.js'
import { focusPill, setActive, useSearch } from '../../lib/search/session.js'
import GoToChips from '../../ds/GoToChips.jsx'
import SearchRow from '../../ds/SearchRow.jsx'
import SearchSection from '../../ds/SearchSection.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import SearchListbox from './SearchListbox.jsx'
import { optionProps, rowId } from './options.js'
import { useBeforeTyping } from './use-before-typing.js'

// Before anything is typed (boards Sh0Search, Sh0SearchFirst, Sh0SearchTrain, Sh0SearchEat,
// Sh0Cleared), on the stage: the tab's four Go to chips, Recent (each with its own ×, Clear with
// the 8 s Undo toast) and up to three suggestions for right now. On a first use (nothing ever
// searched) the suggestions come first, under "Search everything", then Go to. The data is
// use-before-typing.js's.
//
// Recent's entries and the suggestions are the options of the results listbox (the header's field
// is its combobox), each card a group named by its heading. An option holds no control, so a
// Recent entry's × is not inside its row: it is the option right after it, drawn at the row's
// end; the arrow keys reach it next and Enter removes the entry. The Go to chips and Clear are
// actions, not choices: plain buttons in the tab order.
export default function BeforeTyping({ data, tab, onOpen, onChip, onQuery }) {
  const view = useBeforeTyping(data, tab)
  const active = useSearch(s => s.active)
  const { recents, suggested, shortcuts } = view

  const clear = () => {
    view.clear()
    setActive(null)
    // Clear leaves with Recent: the focus goes back to the field rather than to nothing.
    focusPill()
  }
  // The × the arrow keys are on hands them to the entry that takes its place.
  const remove = i => {
    const e = recents[i]
    const next = recents[i + 1] || recents[i - 1]
    if (active === rowId('x:' + e.key)) setActive(next ? rowId(next.key) : null)
    view.remove(e.r)
  }

  const chips = <GoToChips items={shortcuts.map(c => ({ id: c.id, label: t(c.label), icon: c.glyph, onClick: () => onChip(c) }))} />

  const suggestions = suggested.length > 0 && <SearchSection title={t('Suggested')} groupProps={{ role: 'group' }}>
    {suggested.map(r => <SearchRow key={r.key} title={r.title} sub={r.sub} media={r.media} onClick={() => onOpen(r)}
      optionProps={optionProps(r.key, active)} />)}
  </SearchSection>

  if (view.firstUse) {
    return <>
      <StageEmpty card={false} icon="magnifier" title={t('Search everything')} body={t('Find any page, setting, exercise, workout, food or day.')} />
      <SearchListbox>{suggestions}</SearchListbox>
      {chips}
    </>
  }
  // Recent cleared, or every entry gone: Go to, then Suggested (board Sh0Cleared).
  if (!recents.length) return <>{chips}<SearchListbox>{suggestions}</SearchListbox></>

  return <>
    {chips}
    <SearchListbox>
      <SearchSection title={t('Recent')} action={t('Clear')} onAction={clear} groupProps={{ role: 'group' }}>
        {recents.map((e, i) => <SearchRow key={e.key}
          title={e.row ? e.row.title : e.r.query} sub={e.sub} media={e.row ? e.row.media : { kind: 'glyph', glyph: 'clock' }}
          onClick={() => (e.row ? onOpen(e.row) : onQuery(e.r.query))} optionProps={optionProps(e.key, active)}
          onRemove={() => remove(i)} removeProps={optionProps('x:' + e.key, active)} />)}
      </SearchSection>
      {suggestions}
    </SearchListbox>
  </>
}
