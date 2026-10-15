import { useEffect, useMemo } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { t } from '../../lib/i18n.js'
import { CONTENT_SPRING, CONTENT_EXIT_DURATION, EXIT_EASE } from '../../lib/motion.js'
import { clearRecents, pruneRecents, removeRecent, restoreRecents, useRecents } from '../../lib/search/recents.js'
import { resolveRef, shortcutsFor, sourceReady, suggestionsFor } from '../../lib/search/start.js'
import { useSearch } from '../../lib/search/session.js'
import { useUI } from '../../store/useUI.js'
import Icon from '../Icon.jsx'
import { Chip, ChipRow } from '../blocks.jsx'
import { Button } from '../ui.jsx'
import ResultMedia from './ResultMedia.jsx'
import ResultRow, { rowId } from './ResultRow.jsx'

const recentKey = r => (r.kind === 'query' ? 'q:' + r.query.toLowerCase() : r.type + ':' + r.id)

// Before anything is typed (ux-search.md §2, ui-search.md §4): the tab's four shortcuts, Recent
// (each with its own ×, Clear with Undo) and up to three suggestions for right now. On a first run
// (nothing recent) the suggestions come first, under a line saying what search does.
export default function BeforeTyping({ data, tab, onOpen, onChip, onQuery }) {
  const list = useRecents(s => s.list)
  const active = useSearch(s => s.active)
  const entries = useMemo(() => list.map(r => {
    if (r.kind === 'query') return { r, key: recentKey(r) }
    const row = resolveRef(r.type, r.id, data)
    return row ? { r, key: recentKey(r), row } : { r, key: recentKey(r), gone: sourceReady(r.type, data) }
  }), [list, data])
  // A deleted target drops out of Recent once its source has answered.
  useEffect(() => {
    if (entries.some(e => e.gone)) pruneRecents(r => !entries.find(e => e.r === r)?.gone)
  }, [entries])
  const recents = entries.filter(e => e.r.kind === 'query' || e.row)
  const suggested = useMemo(() => suggestionsFor(tab, data), [tab, data])
  const shortcuts = shortcutsFor(tab, data.nutrition)

  const clear = () => {
    const before = clearRecents()
    useUI.getState().toast(t('Recent searches cleared'), { action: t('Undo'), onAction: () => restoreRecents(before) })
  }

  const chips = <section className="sr-sect" aria-labelledby="sr-goto">
    <div className="sr-sect-h"><h2 id="sr-goto" className="sr-sect-t">{t('Go to')}</h2></div>
    <ChipRow className="sr-chips">
      {shortcuts.map(c => <Chip key={c.id} size="lg" nocap icon={c.glyph} onClick={() => onChip(c)}>{t(c.label)}</Chip>)}
    </ChipRow>
  </section>

  const suggestions = suggested.length > 0 && <section className="sr-sect" aria-labelledby="sr-sugg">
    <div className="sr-sect-h"><h2 id="sr-sugg" className="sr-sect-t">{t('Suggested')}</h2></div>
    <div className="sr-card">{suggested.map(r => <ResultRow key={r.key} r={r} onOpen={onOpen} />)}</div>
  </section>

  if (!recents.length) {
    return <>
      {suggestions && <p className="sr-help">{t('Find any page, setting, exercise, workout, food or day.')}</p>}
      {suggestions}
      {chips}
    </>
  }

  return <>
    {chips}
    <section className="sr-sect" aria-labelledby="sr-recent">
      <div className="sr-sect-h">
        <h2 id="sr-recent" className="sr-sect-t">{t('Recent')}</h2>
        <Button size="sm" variant="plain" className="sr-clear" onClick={clear}>{t('Clear')}</Button>
      </div>
      <div className="sr-card">
        <AnimatePresence initial={false}>
          {recents.map(e => (
            <m.div key={e.key} className="sr-recent" layout="position" exit={{ opacity: 0, transition: { duration: CONTENT_EXIT_DURATION, ease: EXIT_EASE } }}
              transition={CONTENT_SPRING}>
              {e.row
                ? <ResultRow r={e.row} trail={false} onOpen={() => onOpen(e.row)} />
                : <button type="button" id={rowId(e.key)} data-search-row="" className={'sr-row' + (active === rowId(e.key) ? ' on' : '')} tabIndex={-1} onClick={() => onQuery(e.r.query)}>
                  <ResultMedia media={{ kind: 'glyph', glyph: 'clock' }} />
                  <span className="sr-text"><span className="sr-title">{e.r.query}</span></span>
                </button>}
              <button type="button" className="sr-x" onClick={() => removeRecent(e.r)}
                aria-label={t('Remove {0} from recent', e.row ? e.row.title : e.r.query)}><Icon name="xmark" /></button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
    {suggestions}
  </>
}
