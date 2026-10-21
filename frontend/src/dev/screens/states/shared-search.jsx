import { useLayoutEffect, useState } from 'react'
import RootHeader from '../../../components/RootHeader.jsx'
import { SearchSurface } from '../../../components/search/SearchOverlay.jsx'
import { useRecents } from '../../../lib/search/recents.js'
import { useSearch } from '../../../lib/search/session.js'
import { customExSheet } from '../../../sheets.jsx'
import { useUI } from '../../../store/useUI.js'
import { pending } from '../mock-env.js'
import { registerScreens } from '../registry.js'
import { BENCH_ID, DAY_AGO, FOOD_ID, searchData } from './shared-search-fixture.js'

// The search (PR-07, boards Sh0Search to Sh0NoExercise, and T6.9 from H0.9): the real tab-root
// header, its pill the field, over the real results panel (SearchOverlay's SearchSurface, which is
// the overlay standing still), on the in-memory fixture (shared-search-fixture.js). The session
// and Recent are set in memory for as long as the state is up and put back after; nothing is
// written to localStorage (every state has searched before, or types nothing, and its Recent
// entries all resolve). Open Food Facts answers from the mocked proxy.
const ALEX = { id: 'u1', name: 'Alex' }
const NO_PRODUCTS = { count: 0, page: 1, page_size: 20, products: [] }
const mock = (proxy = NO_PRODUCTS, extra = {}) => ({ user: ALEX, api: { 'GET /api/proxy': proxy }, ...extra })
const NOOP = () => {}

const RECENTS = [
  { kind: 'query', query: 'press' },
  { kind: 'result', type: 'exercise', id: BENCH_ID, label: 'Bench press', query: 'bench' },
  { kind: 'result', type: 'food', id: FOOD_ID, label: 'Greek yogurt 2%', query: 'yog' },
  { kind: 'result', type: 'day', id: DAY_AGO, label: 'Day', query: '' },
]

function SearchState({ tab, query = '', group = null, recents = RECENTS, searched = true }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const session = useSearch.getState()
    const kept = useRecents.getState()
    useRecents.setState({ list: recents, searched, opened: {} })
    useSearch.setState({ open: true, live: true, id: 'gallery', base: 0, tab, query, group, active: null, scrollTop: 0, origin: null, date: undefined })
    setReady(true)
    return () => { useSearch.setState(session, true); useRecents.setState(kept, true) }
  }, [tab, query, group, recents, searched])
  if (!ready) return null
  return <>
    <RootHeader title="Search" />
    <SearchSurface data={searchData()} />
  </>
}

const at = tab => ({ home: '/home', train: '/train', food: '/food', me: '/progress' })[tab]
const state = (id, title, note, props, extra = {}) => ({
  id, title, note, path: at(props.tab), render: () => <SearchState {...props} />, mock: mock(), ...extra,
})

registerScreens('Shared: search', [
  state('H0.0', 'Search, before typing', 'From Today: Go to, Recent with × and Clear, Suggested. The header stays; the bell is the ×.',
    { tab: 'home' }),
  state('H0.1', 'First search', 'Nothing searched yet: "Search everything", Suggested, then Go to.',
    { tab: 'home', recents: [], searched: false }),
  state('H0.2', 'Search from Train', '"Search training", Train\'s Go to and suggestions.',
    { tab: 'train', recents: RECENTS.slice(0, 2) }),
  state('H0.3', 'Search from Eat', '"Search food", Eat\'s Go to and suggestions.',
    { tab: 'food', recents: RECENTS.slice(2, 3) }),
  state('H0.4', 'Results', 'Counts as chips, the best match, each kind with See all.',
    { tab: 'home', query: 'press' }),
  // Each its own query: a search still out for one query is joined by the next state that asks it.
  state('H0.4-searching', 'Results, Open Food Facts searching', 'Your own results at once; the online row says Searching….',
    { tab: 'home', query: 'yogurt' }, { mock: mock(pending) }),
  state('H0.4-error', 'Results, Open Food Facts failed', 'Couldn’t reach Open Food Facts · Try again.',
    { tab: 'home', query: 'greek' }, { mock: mock({ status: 500, body: { error: 'upstream_error' } }) }),
  state('H0.4-offline', 'Results, offline', 'The Open Food Facts row is left out.',
    { tab: 'home', query: 'chicken' }, { mock: mock(NO_PRODUCTS, { online: false }) }),
  state('H0.5', 'Only workouts', 'A kind picked from the counts: the chip in the field, every match by month.',
    { tab: 'home', query: 'press', group: 'workouts' }),
  state('H0.6', 'Nothing matches', 'Did you mean, Create food, Create exercise, Search Open Food Facts.',
    { tab: 'me', query: 'protien bar' }),
  state('H0.7', 'Recent cleared', 'Recent is gone at once; the toast offers Undo for 8 s (held here).',
    { tab: 'home', recents: [] }, {
      play: async t => {
        useUI.getState().toast('Recent searches cleared', { action: 'Undo', onAction: NOOP, ms: 8000 })
        useUI.getState().pauseToast()
        await t.wait(60)
      },
    }),
  state('H0.8', 'A feature that is off', 'Fasting is off: one card with Turn on and Features, then what still matches.',
    { tab: 'home', query: 'fast' }),
  state('H0.9', 'No such exercise', 'From Train: Create the name first, then the nearest name.',
    { tab: 'train', query: 'cable Y raise' }),
  state('T6.9', 'New exercise, named', 'Create from H0.9: the custom-exercise sheet with the typed name, until Train\'s New exercise page (T6.4).',
    { tab: 'train', query: 'cable Y raise' }, {
      play: async t => { customExSheet(null, null, 'cable Y raise'); await t.wait(200) },
    }),
])
