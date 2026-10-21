import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react'
import { t, tn } from '../../lib/i18n.js'
import {
  CONTENT_ENTER_DELAY, CONTENT_EXIT, CONTENT_SPRING, LIST_CONTAINER, LIST_ITEM, REDUCED, SURFACE_EXIT, SURFACE_SPRING, contentSwapVariants, skeletonSwapVariants,
} from '../../lib/motion.js'
import { SEARCH_OVERLAY_ID, closeSearch, rememberScroll, setActive, setGroup, setOverlayKeys, setQuery, useSearch } from '../../lib/search/session.js'
import { GROUP_LIMIT, groupCount, groupTitle } from '../../lib/search/results.js'
import { addRecent } from '../../lib/search/recents.js'
import { syncDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { EmptySurface, Kbd } from '../blocks.jsx'
import BeforeTyping from './BeforeTyping.jsx'
import BestMatch from './BestMatch.jsx'
import NoResults from './NoResults.jsx'
import ResultGroup from './ResultGroup.jsx'
import ResultList from './ResultList.jsx'
import ResultRow from './ResultRow.jsx'
import ScopeToken from './ScopeToken.jsx'
import { SkeletonRows, SourceNote } from './SourceStatus.jsx'
import SummaryLine from './SummaryLine.jsx'
import { openResult, openShortcut, runNoneAction } from './open-result.js'
import { useReducedMotionPref } from './use-reduced-motion.js'
import { useSearchData } from './use-search-data.js'
import { useSearchResults } from './use-search-results.js'

// The term the lists are keyed on: 250 ms without typing (bearmenu's debounce). Between settles
// the rows update in place, keyed by type and id; at a settle the stagger plays again.
function useSettled(value, ms) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    if (value === settled) return undefined
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, settled, ms])
  return settled
}

const PAGE = 60

// The overlay (fitness-eval ux-search.md, ui-search.md): a results surface under the header,
// whose pill stays the only input and keeps the focus. The pill is a combobox and what it pops up
// is the results listbox (ResultList) in here: its groups, its options, the one the arrow keys
// are on as the pill's aria-activedescendant (§6). On a phone it fills the screen below the
// header; at 1000px and up it is a 680px panel over the dimmed page, with a footer naming the
// keys. It opens and closes with bearmenu's springs.
export default function SearchOverlay() {
  const open = useSearch(s => s.open)
  const reduced = useReducedMotionPref()
  const surface = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: REDUCED }, exit: { opacity: 0, transition: REDUCED } }
    : { hidden: { opacity: 0 }, visible: { opacity: 1, transition: SURFACE_SPRING }, exit: { opacity: 0, transition: SURFACE_EXIT } }
  const content = reduced
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: REDUCED }, exit: { opacity: 0, transition: REDUCED } }
    : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { ...CONTENT_SPRING, delay: CONTENT_ENTER_DELAY } }, exit: { opacity: 0, y: 8, transition: CONTENT_EXIT } }
  return <LazyMotion features={domAnimation}>
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <AnimatePresence>
        {open && <m.div key="search" className="search-ov" id={SEARCH_OVERLAY_ID}
          variants={surface} initial="hidden" animate="visible" exit="exit">
          {/* Desktop: the dimmed page closes it; out of the tab order, Escape is the key for it. */}
          <button type="button" className="search-scrim" tabIndex={-1} aria-label={t('Close search')} onClick={closeSearch} />
          <m.div className="search-panel" variants={content} initial="hidden" animate="visible" exit="exit">
            <OverlayBody />
          </m.div>
        </m.div>}
      </AnimatePresence>
    </MotionConfig>
  </LazyMotion>
}

function OverlayBody() {
  const query = useSearch(s => s.query)
  const group = useSearch(s => s.group)
  const tab = useSearch(s => s.tab)
  const scrollTop = useSearch(s => s.scrollTop)
  const data = useSearchData(true)
  const deferred = useDeferredValue(query)
  const settled = useSettled(query, 250)
  const spoken = useSettled(query, 900)
  const { local, online, rowsOf, counts: summary, total, noResults, none, scoped } = useSearchResults({ query: deferred, live: query, settled, group, tab, data })
  const hasQuery = query.trim().length > 0
  const scroller = useRef(null)
  const [limit, setLimit] = useState(PAGE)

  // Back on the overlay: the scroll where it was left.
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = scrollTop }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLimit(PAGE) }, [group, settled])

  const open = useCallback(r => {
    setActive(null)
    openResult(r, { query })
  }, [query])
  const scope = g => { setGroup(g); if (scroller.current) scroller.current.scrollTop = 0 }

  // The groups as they render: the local ones, Online last, and a slow source's status in its place.
  const idx = data.index
  const daysStatus = !data.nutrition || local.groups.days.length ? null
    : !idx.complete && idx.status !== 'error' && !data.days.length ? <SkeletonRows />
    : idx.offline && !data.days.length ? <SourceNote kind="offline-days" place="days" />
    : idx.status === 'error' && !data.days.length ? <SourceNote kind="error" place="days" source={t('your diary')} onRetry={() => syncDiaryIndex({ force: true })} />
    : null
  const onlineStatus = online.status === 'loading' ? <SkeletonRows />
    : online.status === 'paused' ? <SourceNote kind="paused" place="online" seconds={online.seconds} source={t('Open Food Facts')} />
    : online.status === 'error' ? <SourceNote kind="error" place="online" source={t('Open Food Facts')} onRetry={online.retry} />
    : online.status === 'offline' ? <SourceNote kind="offline" place="online" />
    : online.status === 'tap' ? <ResultRow r={{ type: 'action', key: 'online-ask', title: t('Search Open Food Facts for “{0}”', settled.trim()), media: { kind: 'glyph', glyph: 'globe' } }} onOpen={online.ask} />
    : null
  const statusOf = g => (g === 'days' ? daysStatus : g === 'online' ? onlineStatus : null)
  const shown = local.order.filter(g => rowsOf(g).length || statusOf(g))

  // Scoped: one group, whole, in pages of 60 as it scrolls (5,600 exercises).
  const scopedRows = scoped ? scoped.rows : []

  // One polite live region, spoken 900 ms after typing stops (ux §6).
  const message = !hasQuery ? '' : spoken !== query ? ''
    : noResults ? t('Nothing matches “{0}”', query.trim())
    : t('{0}: {1}', tn('{0} result', '{0} results', total), summary.map(e => groupCount(e.group, e.count)).join(', '))
    + (online.status === 'paused' ? '. ' + t('Open Food Facts paused') : online.status === 'error' ? '. ' + t('Couldn’t reach {0}', t('Open Food Facts')) : '')

  // The pill's keys: ↑ ↓ across every option of the listbox, from group to group, Home and End,
  // Enter activates the active option or keeps the query in Recent, Backspace in an empty pill
  // drops the scope.
  useEffect(() => {
    setOverlayKeys(e => {
      const rows = [...(scroller.current?.querySelectorAll('[role="listbox"] [role="option"]') || [])]
      const at = rows.findIndex(r => r.id === useSearch.getState().active)
      const go = i => {
        const el = rows[i]
        if (!el) return
        setActive(el.id)
        el.scrollIntoView?.({ block: 'nearest' })
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); go(at < 0 ? 0 : Math.min(rows.length - 1, at + 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (at > 0) go(at - 1); else setActive(null); return }
      if (e.key === 'Home' && at >= 0) { e.preventDefault(); go(0); return }
      if (e.key === 'End' && at >= 0) { e.preventDefault(); go(rows.length - 1); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (at >= 0) { rows[at].click(); return }
        const q = useSearch.getState().query.trim()
        if (q) { addRecent({ kind: 'query', query: q }); e.currentTarget?.blur?.() }
        return
      }
      if (e.key === 'Backspace' && !useSearch.getState().query && useSearch.getState().group) { e.preventDefault(); setGroup(null) }
    })
    return () => setOverlayKeys(null)
  }, [])

  const onScroll = e => {
    const el = e.currentTarget
    rememberScroll(el.scrollTop)
    if (group && el.scrollTop + el.clientHeight > el.scrollHeight - 600 && limit < scopedRows.length) setLimit(l => l + PAGE)
  }
  // Scrolling the results hides the keyboard, and only that.
  const onTouchMove = () => { const a = document.activeElement; if (a?.classList?.contains('spill-i')) a.blur() }

  const chip = c => { if (c.target.kind === 'scope' && scroller.current) scroller.current.scrollTop = 0; openShortcut(c) }

  const actions = noResults && none
    ? none.actions.map(a => ({ key: a.key, title: a.title, subtitle: a.sub, glyph: a.glyph, run: () => runNoneAction(a, { askOnline: online.ask }) }))
    : []

  let body
  if (group) {
    body = <>
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={'scope-' + group} variants={contentSwapVariants} initial="hidden" animate="show" exit="exit">
          <ScopeToken group={group} count={scopedRows.length} onClear={() => scope(null)} />
        </m.div>
      </AnimatePresence>
      <ResultList>
        <div className="sr-card">
          <m.div key={group + '|' + settled} variants={LIST_CONTAINER} initial="hidden" animate="show">
            {scopedRows.slice(0, limit).map((r, i) => (i < 12
              ? <m.div key={r.key} variants={LIST_ITEM}><ResultRow r={r} onOpen={open} /></m.div>
              : <ResultRow key={r.key} r={r} onOpen={open} />))}
          </m.div>
        </div>
        {!scopedRows.length && statusOf(group)}
      </ResultList>
    </>
  } else if (!hasQuery) {
    body = <BeforeTyping data={data} tab={tab} onOpen={open} onChip={chip} onQuery={setQuery} />
  } else if (noResults) {
    body = <EmptySurface value="sheet"><NoResults query={query} actions={actions} /></EmptySurface>
  } else {
    body = <m.div key={settled} variants={LIST_CONTAINER} initial="hidden" animate="show">
      <m.div variants={LIST_ITEM}><SummaryLine entries={summary} onScope={scope} /></m.div>
      <ResultList>
        {local.best && <m.div variants={LIST_ITEM}><BestMatch r={local.best.result} onOpen={open} /></m.div>}
        {shown.map(g => {
          const rows = rowsOf(g)
          const status = statusOf(g)
          return <AnimatePresence key={g} mode="wait" initial={false}>
            <m.div key={status ? 'status' : 'rows'} variants={skeletonSwapVariants} initial="hidden" animate="show" exit="exit">
              <ResultGroup id={'sr-g-' + g} group={g} title={groupTitle(g)} rows={rows.slice(0, GROUP_LIMIT)} total={rows.length}
                onOpen={open} onShowAll={() => scope(g)} status={rows.length ? null : status} />
            </m.div>
          </AnimatePresence>
        })}
      </ResultList>
    </m.div>
  }

  return <>
    <div className="sr-only" role="status" aria-live="polite">{message}</div>
    <div className="search-scroll" ref={scroller} onScroll={onScroll} onTouchMove={onTouchMove}>
      <div className="search-body">{body}</div>
    </div>
    <div className="search-foot" aria-hidden="true">
      <Kbd>esc</Kbd><span>{query ? t('to clear') : t('to close')}</span>
      <Kbd>↑</Kbd><Kbd>↓</Kbd><span>{t('to move')}</span>
      <Kbd>↵</Kbd><span>{t('to open')}</span>
    </div>
  </>
}
