import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { m } from 'motion/react'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { LIST_CONTAINER, LIST_ITEM, SURFACE_EXIT, SURFACE_SPRING } from '../../lib/motion.js'
import { syncDiaryIndex } from '../../lib/nutrition/diary-index.js'
import { GROUP_LIMIT, groupCount, kindLabel, stageSub } from '../../lib/search/results.js'
import { addRecent } from '../../lib/search/recents.js'
import { groupTitle } from '../../lib/search/scopes.js'
import { rememberScroll, setActive, setGroup, setOverlayKeys, setQuery, useSearch } from '../../lib/search/session.js'
import BestMatch from '../../ds/BestMatch.jsx'
import ResultChips from '../../ds/ResultChips.jsx'
import SearchFeatureCard from '../../ds/SearchFeatureCard.jsx'
import SearchRow, { SearchMedia } from '../../ds/SearchRow.jsx'
import SearchSection from '../../ds/SearchSection.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import BeforeTyping from './BeforeTyping.jsx'
import SearchListbox from './SearchListbox.jsx'
import { openFeaturePage, openResult, openShortcut, runNoneAction, turnOnFeature } from './open-result.js'
import { optionProps } from './options.js'
import { useReducedMotionPref } from './use-reduced-motion.js'
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

// A scoped kind lists all of its matches, in pages of 60 as it scrolls (5,600 exercises).
const PAGE = 60

// The scroller's 8px rise inside the overlay as it comes and goes, on the overlay's own variants
// (SearchOverlay): the panel itself only fades, so its top edge never parts from the header. None
// under reduced motion, and none standing still (the gallery's SearchSurface sets no variant).
const SCROLL_RISE = {
  hidden: { y: 8 },
  visible: { y: 0, transition: SURFACE_SPRING },
  exit: { y: 8, transition: SURFACE_EXIT },
}

// A source's place while it says something rather than rows ("Searching Open Food Facts…"): the
// row's shape, nothing to press.
function NoteRow({ glyph, title, sub }) {
  return <div className="g-srow-wrap g-srow-stage">
    <div className="g-srow g-srow-main g-srow-note">
      <SearchMedia media={{ kind: 'glyph', glyph }} />
      <span className="g-srow-text">
        <span className="g-srow-title">{title}</span>
        {sub && <span className="g-srow-sub">{sub}</span>}
      </span>
    </div>
  </div>
}

// A switched-off feature's card (board Sh0TurnOn): Turn on flips it where it lives, and the card
// gives way to the page once the data says it is on; Features opens the page with its switch.
function FeatureCard({ r }) {
  const [busy, setBusy] = useState(false)
  const turnOn = async () => {
    setBusy(true)
    await turnOnFeature(r)
    setBusy(false)
  }
  return <div className="search-card">
    <SearchFeatureCard title={r.title} ranges={r.ranges} line={r.line} icon={r.media?.glyph} pageTitle={r.pageTitle}
      busy={busy} onTurnOn={turnOn} onOpenPage={() => openFeaturePage(r)} />
  </div>
}

/**
 * The search's results panel (boards Sh0Search to Sh0NoExercise): what shows under the pinned
 * header, whose field is the only input (components/use-root-header.js). The query, the scope and
 * the tab are the session's (lib/search/session.js); `data` is what the local sources read
 * (use-search-data.js, or a gallery's fixture). By state:
 *   nothing typed     BeforeTyping: Go to, Recent, Suggested (or the first use)
 *   one kind          the summary, then every match of it, workouts by month (Sh0Scoped)
 *   typed             the count chips, a feature's Turn on card, the best match, each kind with
 *                     See all; Open Food Facts last, or its row while it is not rows (Sh0Results)
 *   nothing matches   says so, then the ways on that apply (Sh0None); an exercise search that
 *                     found no exercise says that, Create first, above what else matched
 *                     (Sh0NoExercise)
 * The field is a combobox whose popup is the one SearchListbox here: the arrows walk every option
 * in it, Enter opens the active one or keeps the query in Recent, Backspace in an empty field drops
 * the scope.
 */
export default function SearchPanel({ data }) {
  const query = useSearch(s => s.query)
  const group = useSearch(s => s.group)
  const tab = useSearch(s => s.tab)
  const scrollTop = useSearch(s => s.scrollTop)
  const active = useSearch(s => s.active)
  const deferred = useDeferredValue(query)
  const settled = useSettled(query, 250)
  const spoken = useSettled(query, 900)
  const { local, online, onlineRow, rowsOf, counts, total, noResults, none, scoped } = useSearchResults({ query: deferred, live: query, settled, group, tab, data })
  const hasQuery = query.trim().length > 0
  const scroller = useRef(null)
  const reduced = useReducedMotionPref()
  const [limit, setLimit] = useState(PAGE)

  // Back on the overlay: the scroll where it was left.
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = scrollTop }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLimit(PAGE) }, [group, settled])

  const open = useCallback(r => {
    setActive(null)
    openResult(r, { query })
  }, [query])
  const scope = g => { setGroup(g); if (scroller.current) scroller.current.scrollTop = 0 }
  const chip = c => { if (c.target.kind === 'scope' && scroller.current) scroller.current.scrollTop = 0; openShortcut(c) }

  // A slow source's row in its group's place while it has no rows (PR07Edges, H0): Open Food
  // Facts searching, failed, paused or asked for on a tap, and left out offline; the diary's days
  // on their first sync.
  const src = t('Open Food Facts')
  const onlineStatus = onlineRow === 'searching' ? <NoteRow glyph="globe" title={t('Searching Open Food Facts…')} />
    : onlineRow === 'paused' ? <NoteRow glyph="hourglass" title={t('{0} paused · back in', src) + ' ' + t('{0} s', online.seconds)} />
    : onlineRow === 'error' ? <SearchRow title={t('Couldn’t reach {0}', src)} sub={t('Try again')} media={{ kind: 'glyph', glyph: 'warning' }}
      onClick={online.retry} optionProps={optionProps('note:online', active)} />
    : onlineRow === 'tap' ? <SearchRow title={t('Search Open Food Facts for “{0}”', settled.trim())} media={{ kind: 'glyph', glyph: 'globe' }}
      onClick={online.ask} optionProps={optionProps('online-ask', active)} />
    : null
  const idx = data.index
  const daysStatus = !data.nutrition || local.groups.days.length || data.days.length ? null
    : !idx.complete && idx.status !== 'error' && !idx.offline ? <NoteRow glyph="hourglass" title={t('Still indexing your diary')} />
    : idx.offline ? <NoteRow glyph="cloudSlash" title={t('Days need a connection the first time')} />
    : idx.status === 'error' ? <SearchRow title={t('Couldn’t reach {0}', t('your diary'))} sub={t('Try again')} media={{ kind: 'glyph', glyph: 'warning' }}
      onClick={() => syncDiaryIndex({ force: true })} optionProps={optionProps('note:days', active)} />
    : null
  const statusOf = g => (g === 'days' ? daysStatus : g === 'online' ? onlineStatus : null)

  const row = r => <SearchRow key={r.key} title={r.title} ranges={r.ranges} sub={stageSub(r)} media={r.media} onClick={() => open(r)}
    optionProps={optionProps(r.key, active)} />

  // One polite live region, spoken 900 ms after typing stops.
  const message = !hasQuery ? '' : spoken !== query ? ''
    : noResults ? t('Nothing matches “{0}”', query.trim())
    : t('{0}: {1}', tn('{0} result', '{0} results', total), counts.map(e => groupCount(e.group, e.count)).join(', '))
    + (online.status === 'paused' ? '. ' + t('Open Food Facts paused') : online.status === 'error' ? '. ' + t('Couldn’t reach {0}', src) : '')

  // The field's keys: ↑ ↓ across every option of the listbox, from group to group, Home and End,
  // Enter activates the active option or keeps the query in Recent, Backspace in an empty field
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

  const scopedRows = scoped ? scoped.rows : []
  const onScroll = e => {
    const el = e.currentTarget
    rememberScroll(el.scrollTop)
    if (group && el.scrollTop + el.clientHeight > el.scrollHeight - 600 && limit < scopedRows.length) setLimit(l => l + PAGE)
  }
  // Scrolling the results hides the keyboard, and only that.
  const onTouchMove = () => { const a = document.activeElement; if (a?.closest?.('.g-spill-field')) a.blur() }

  // Says what is missing; the ways on are options, in the listbox with whatever else matched.
  const noneHeading = none && <m.div variants={LIST_ITEM}>
    <StageEmpty card={false} icon={none.mode === 'exercise' ? 'dumbbell' : 'magnifier'} title={none.heading.title} body={none.heading.body} />
  </m.div>
  const noneActions = none && none.actions.length > 0 && <m.div variants={LIST_ITEM} className="search-acts">
    <SearchSection groupProps={{ role: 'group', 'aria-label': none.heading.title }}>
      {none.actions.map(a => <SearchRow key={a.key} title={a.title} sub={a.sub} media={{ kind: 'glyph', glyph: a.glyph }}
        onClick={() => runNoneAction(a, { askOnline: online.ask })} optionProps={optionProps('none:' + a.key, active)} />)}
    </SearchSection>
  </m.div>

  let body
  if (group) {
    // The rows of the sections up to the page shown so far.
    let left = limit
    const sections = (scoped?.sections || []).map(sec => {
      const rows = sec.rows.slice(0, Math.max(0, left))
      left -= rows.length
      return { ...sec, rows }
    }).filter(sec => sec.rows.length)
    body = <m.div key={'scope-' + group + '|' + settled} variants={LIST_CONTAINER} initial="hidden" animate="show">
      <m.p variants={LIST_ITEM} className="search-sum">{t('{0}. × on the chip shows everything again.', scoped.summary)}</m.p>
      {group === 'features' && scopedRows.map(r => <FeatureCard key={r.key} r={r} />)}
      {noneHeading}
      <SearchListbox>
        {noneActions}
        {group !== 'features' && sections.map(sec => <m.div key={sec.key} variants={LIST_ITEM}>
          <SearchSection title={sec.title} groupProps={{ role: 'group', 'aria-label': sec.title || groupTitle(group) }}>{sec.rows.map(row)}</SearchSection>
        </m.div>)}
        {!scopedRows.length && statusOf(group) && <SearchSection title={groupTitle(group)} groupProps={{ role: 'group' }}>{statusOf(group)}</SearchSection>}
      </SearchListbox>
    </m.div>
  } else if (!hasQuery) {
    body = <BeforeTyping data={data} tab={tab} onOpen={open} onChip={chip} onQuery={setQuery} />
  } else if (noResults) {
    body = <m.div key={'none|' + settled} variants={LIST_CONTAINER} initial="hidden" animate="show">
      {noneHeading}
      <SearchListbox>{noneActions}</SearchListbox>
    </m.div>
  } else {
    const shown = local.order.filter(g => g !== 'features' && (rowsOf(g).length || statusOf(g)))
    const best = local.best
    // The counts and a feature's card are not choices: they come before the listbox. An exercise
    // search that found no exercise says so above the rest (Sh0NoExercise).
    body = <m.div key={settled} variants={LIST_CONTAINER} initial="hidden" animate="show">
      <m.div variants={LIST_ITEM}><ResultChips items={counts} active={group} onSelect={scope} /></m.div>
      {local.groups.features.map(r => <m.div key={r.key} variants={LIST_ITEM}><FeatureCard r={r} /></m.div>)}
      {noneHeading}
      <SearchListbox>
        {noneActions}
        {best && <m.div variants={LIST_ITEM} className="search-card">
          <BestMatch kind={kindLabel(best.result.type)} title={best.result.title} ranges={best.result.ranges} sub={best.result.subtitle}
            media={best.result.media} onClick={() => open(best.result)} optionProps={optionProps(best.result.key, active)} />
        </m.div>}
        {shown.map(g => {
          const rows = rowsOf(g)
          return <m.div key={g} variants={LIST_ITEM}>
            <SearchSection title={groupTitle(g)} groupProps={{ role: 'group' }}
              action={rows.length > GROUP_LIMIT ? t('See all {0}', rows.length.toLocaleString(dateLocale())) : undefined} onAction={() => scope(g)}>
              {rows.length ? rows.slice(0, GROUP_LIMIT).map(row) : statusOf(g)}
            </SearchSection>
          </m.div>
        })}
      </SearchListbox>
    </m.div>
  }

  return <>
    <div className="sr-only" role="status" aria-live="polite">{message}</div>
    <m.div className="search-scroll" ref={scroller} onScroll={onScroll} onTouchMove={onTouchMove} variants={reduced ? undefined : SCROLL_RISE}>
      <div className="search-body">{body}</div>
    </m.div>
  </>
}
