import { AnimatePresence, m } from 'motion/react'
import { t } from '../../lib/i18n.js'
import { CONTENT_SPRING, CONTENT_EXIT_DURATION, EXIT_EASE } from '../../lib/motion.js'
import { focusPill, setActive, useSearch } from '../../lib/search/session.js'
import Icon from '../Icon.jsx'
import { Chip, ChipRow } from '../blocks.jsx'
import { Button } from '../ui.jsx'
import OptionButton from './OptionButton.jsx'
import ResultList from './ResultList.jsx'
import ResultMedia from './ResultMedia.jsx'
import ResultRow, { rowId } from './ResultRow.jsx'
import { useBeforeTyping } from './use-before-typing.js'

// Before anything is typed (ux-search.md §2, ui-search.md §4): the tab's four shortcuts, Recent
// (each with its own ×, Clear with Undo) and up to three suggestions for right now. On a first use
// (nothing ever searched) the suggestions come first, under a line saying what search does. The
// data is use-before-typing.js's.
//
// The choices are the results listbox, the same model as the results (§6): Recent's entries and
// the suggestions, each section a group named by its heading, every row and × an option. An
// option holds no control, so a Recent entry's × is not inside its row: it is the option right
// after it, drawn at the row's end. The arrow keys reach it next, Enter removes the entry, and a
// screen reader meets it as "Remove … from recent" after the entry it removes. A suggestion
// already in Recent is left out: one row per thing, one id.
//
// The shortcut chips and Clear are actions, not choices: plain buttons beside the listbox, in
// the tab order after the pill (pill, chips, then the listbox the arrows walk) and not counted
// in it.
export default function BeforeTyping({ data, tab, onOpen, onChip, onQuery }) {
  const view = useBeforeTyping(data, tab)
  const { recents, suggested, shortcuts } = view

  const clear = () => {
    view.clear()
    setActive(null)
    // Clear leaves with Recent: the focus goes back to the pill rather than to nothing.
    focusPill()
  }
  // The × of the entry the arrow keys are on hands them to the entry that takes its place.
  const remove = i => {
    const e = recents[i]
    const next = recents[i + 1] || recents[i - 1]
    if (useSearch.getState().active === rowId('x:' + e.key)) setActive(next ? rowId(next.row ? next.row.key : next.key) : null)
    view.remove(e.r)
  }

  const chips = <section className="sr-sect" role="group" aria-labelledby="sr-goto">
    <div className="sr-sect-h"><h2 id="sr-goto" className="sr-sect-t">{t('Go to')}</h2></div>
    <ChipRow className="sr-chips">
      {shortcuts.map(c => <Chip key={c.id} size="lg" nocap icon={c.glyph} onClick={() => onChip(c)}>{t(c.label)}</Chip>)}
    </ChipRow>
  </section>

  const suggestions = suggested.length > 0 && <section className="sr-sect" role="group" aria-labelledby="sr-sugg">
    <div className="sr-sect-h"><h2 id="sr-sugg" className="sr-sect-t">{t('Suggested')}</h2></div>
    <div className="sr-card">{suggested.map(r => <ResultRow key={r.key} r={r} onOpen={onOpen} />)}</div>
  </section>

  if (view.firstUse) {
    return <>
      <p className="sr-help">{t('Find any page, setting, exercise, workout, food or day.')}</p>
      <ResultList>{suggestions}</ResultList>
      {chips}
    </>
  }
  // Recent cleared, or every entry gone: Go to, then Suggested (board Sh0Cleared).
  if (!recents.length) {
    return <>
      {chips}
      <ResultList>{suggestions}</ResultList>
    </>
  }

  return <>
    {chips}
    <div className="sr-sect-h">
      <h2 id="sr-recent" className="sr-sect-t">{t('Recent')}</h2>
      <Button type="button" size="sm" variant="plain" className="sr-clear" onClick={clear}>{t('Clear')}</Button>
    </div>
    <ResultList>
      <div className="sr-sect" role="group" aria-labelledby="sr-recent">
        <div className="sr-card">
          <AnimatePresence initial={false}>
            {recents.map((e, i) => (
              <m.div key={e.key} className="sr-recent" layout="position" exit={{ opacity: 0, transition: { duration: CONTENT_EXIT_DURATION, ease: EXIT_EASE } }}
                transition={CONTENT_SPRING}>
                {e.row
                  ? <ResultRow r={e.row} trail={false} onOpen={() => onOpen(e.row)} />
                  : <OptionButton id={rowId(e.key)} className="sr-row" onClick={() => onQuery(e.r.query)}>
                    <ResultMedia media={{ kind: 'glyph', glyph: 'clock' }} />
                    <span className="sr-text"><span className="sr-title">{e.r.query}</span></span>
                  </OptionButton>}
                <OptionButton id={rowId('x:' + e.key)} className="sr-x" onClick={() => remove(i)}
                  aria-label={t('Remove {0} from recent', e.row ? e.row.title : e.r.query)}><Icon name="xmark" /></OptionButton>
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      {suggestions}
    </ResultList>
  </>
}
