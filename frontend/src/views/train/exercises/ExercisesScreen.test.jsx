// @vitest-environment happy-dom
// T6.0 Exercises: favourites float to the top of the library and carry a star, the exercise names
// keep each language's casing, the sub-line counts the library and what you have logged, a search
// that finds nothing exact offers what comes close, the filter drawers (equipment with the gym
// profile's filter, type), the Favourites chip, Browse by muscle, and Create your own.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExercisesScreen from './ExercisesScreen.jsx'
import { EXDB, EXIDX } from '../../../lib/exercises.js'
import { newProfile } from '../../../lib/equipment.js'
import { capWords, fmtNum } from '../../../lib/format.js'
import { CASED_NAME_LANGS, EXERCISE_NAME_LANGS, _setLangState, exerciseNameFor } from '../../../lib/i18n-core.js'
import { DEF, useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { exerciseDetailSheet } from '../../../sheets.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
// The first render indexes the 5,600+ catalogue exercises, which takes a while on a busy runner.
vi.setConfig({ testTimeout: 15000 })
vi.mock('../../../sheets.jsx', async importOriginal => ({ ...(await importOriginal()), exerciseDetailSheet: vi.fn() }))

const BENCH = '0025'   // barbell bench press
const mounted = []
function Where() {
  const loc = useLocation()
  return <p id="where">{loc.pathname + loc.search}</p>
}
function mount(node, path = '/train/exercises') {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/train/exercises" element={node} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  ))
  return host
}
const render = () => mount(<ExercisesScreen />)
const cards = host => [...host.querySelectorAll('.g-xr')]
const nameOf = row => row.querySelector('.g-xrow-b b').textContent
const names = host => cards(host).flatMap(c => [...c.querySelectorAll('.g-xrow')].map(nameOf))
const libraryNames = host => [...cards(host).at(-1).querySelectorAll('.g-xrow')].map(nameOf)
const titles = host => [...host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)
const chip = (host, text) => [...host.querySelectorAll('.g-fchip')].find(b => b.textContent.startsWith(text))
const bodyPart = (host, text) => [...host.querySelectorAll('.g-cchip')].find(b => b.textContent === text)
function type(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, value)
  act(() => { el.dispatchEvent(new Event('input', { bubbles: true })) })
}
const search = (host, text) => type(host.querySelector('.g-ssf input'), text)
// The drawer that is on top, drawn into its own host.
function drawer() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const radios = host => [...host.querySelectorAll('[role="radio"]')]
const radio = (host, text) => radios(host).find(r => r.textContent === text)
const sets = n => Array.from({ length: n }, () => ({ w: 80, r: 8, done: true }))
const day = (n, entries) => {
  const d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() - n)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { id: 'w' + n, d: iso, start: d.getTime(), end: d.getTime() + 3600000, name: 'Push', prs: [], entries }
}
const seed = over => useStore.setState(s => ({ S: { ...structuredClone(DEF), ...over, unit: 'kg' }, user: s.user }))

beforeEach(() => {
  seed({})
  useUI.setState({ sheets: [], toastMsg: '' })
  vi.mocked(exerciseDetailSheet).mockClear()
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  _setLangState('en', {}, null, null)
})

describe('Exercises favourites', () => {
  it('puts favourites first, marked with a star, and leaves the rest A to Z', () => {
    const plain = names(render())
    const az = new Intl.Collator('en')
    expect(plain.slice(0, 20)).toEqual([...plain.slice(0, 20)].sort((a, b) => az.compare(a.toLowerCase(), b.toLowerCase())))
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
    const fav = [plain[6], plain[2]]
    seed({ favEx: fav.map(n => EXDB.find(e => e.n.toLowerCase() === n.toLowerCase()).id) })
    const host = render()
    const shown = names(host)
    expect(shown.slice(0, 2)).toEqual(plain.filter(n => fav.includes(n)))
    expect(shown.slice(2)).toEqual(plain.filter(n => !fav.includes(n)))
    const rows = [...host.querySelectorAll('.g-xrow')]
    expect(rows[0].querySelector('.g-xr-star').getAttribute('aria-label')).toBe('Favourite')
    expect(rows[2].querySelector('.g-xr-star')).toBeNull()
  })

  it('keeps a favourite on top inside a body-part filter, but never pulls one in from elsewhere', () => {
    const chest = EXDB.filter(e => e.bp === 'chest')
    const legs = EXDB.find(e => e.bp !== 'chest')
    seed({ favEx: [chest[4].id, legs.id] })
    const host = render()
    act(() => bodyPart(host, 'Chest').click())
    const shown = names(host)
    expect(shown[0].toLowerCase()).toBe(chest[4].n.toLowerCase())
    expect(shown.map(n => n.toLowerCase())).not.toContain(legs.n.toLowerCase())
  })

  it('the Favourites chip counts the starred ones and filters to them', () => {
    const ids = EXDB.slice(0, 3).map(e => e.id)
    seed({ favEx: ids })
    const host = render()
    expect(chip(host, 'Favourites').textContent).toBe('Favourites · 3')
    expect(chip(host, 'Favourites').getAttribute('aria-pressed')).toBe('false')
    act(() => chip(host, 'Favourites').click())
    expect(chip(host, 'Favourites').getAttribute('aria-pressed')).toBe('true')
    expect(names(host)).toHaveLength(3)
    expect(host.querySelector('.g-ssf-count').textContent).toBe('3')
  })
})

// #290 took the title-casing off every translated name; the packs stored lower-case then read
// lower-case down the whole list. Only German's own casing is left alone.
describe('Exercises name casing per language', () => {
  const packs = import.meta.glob('../../../exercise-names/*.js', { eager: true, import: 'default' })

  for (const lang of EXERCISE_NAME_LANGS) {
    it(`${lang}: every translated row is ${CASED_NAME_LANGS.includes(lang) ? 'left in its own casing' : 'title-cased'}`, () => {
      const pack = packs[`../../../exercise-names/${lang}.js`]
      _setLangState(lang, {}, null, pack)
      // Starred so they render on the first page: a partial pack may not cover the first rows.
      const ids = Object.keys(pack).filter(id => EXIDX[id]).slice(0, 3)
      seed({ favEx: ids })
      const shown = names(render())
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) {
        const raw = exerciseNameFor(EXIDX[id])
        expect(shown, `${lang}: ${raw}`).toContain(CASED_NAME_LANGS.includes(lang) ? raw : capWords(raw))
      }
    })
  }
})

describe('Exercises sub-line', () => {
  const sub = host => host.querySelector('.g-spage-sub').textContent
  const own = n => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, n: 'my move ' + i, bp: 'chest', eq: '', custom: true }))

  it('counts the catalogue, and what you have logged', () => {
    expect(sub(render())).toBe(`${fmtNum(EXDB.length)} in the library · 0 you’ve logged`)
  })

  it('adds your own exercises to the library count', () => {
    seed({ customEx: own(5) })
    expect(sub(render())).toBe(`${fmtNum(EXDB.length + 5)} in the library · 0 you’ve logged`)
  })

  it('counts each logged exercise once, however often it was logged, and skips ids nobody knows', () => {
    seed({ workouts: [
      day(3, [{ id: BENCH, target: {}, sets: sets(2) }, { id: '99999', target: {}, sets: sets(1) }]),
      day(1, [{ id: BENCH, target: {}, sets: sets(2) }]),
    ] })
    expect(sub(render())).toContain('· 1 you’ve logged')
  })
})

describe('Exercises you have logged', () => {
  it('come first under Your exercises, with the best set and the estimated 1RM', () => {
    seed({ workouts: [day(9, [{ id: BENCH, target: { mode: 'reps' }, sets: [{ w: 80, r: 8, done: true }, { w: 82.5, r: 6, done: true }] }])] })
    const host = render()
    expect(titles(host)).toEqual(['Your exercises', 'From the library'])
    expect(host.querySelector('.g-ssec-act').textContent).toBe('1 logged')
    const first = cards(host)[0].querySelector('.g-xrow')
    expect(nameOf(first).toLowerCase()).toBe(EXIDX[BENCH].n.toLowerCase())
    expect(first.querySelector('.g-xrow-b > span').textContent).toMatch(/^Best 82\.5 kg × 6 · est\. 1RM \d+ kg$/)
    // not repeated in the library below
    expect(libraryNames(host).map(n => n.toLowerCase())).not.toContain(EXIDX[BENCH].n.toLowerCase())
  })

  it('leave the estimate out when there is none', () => {
    seed({ workouts: [day(9, [{ id: BENCH, target: { mode: 'reps' }, sets: [{ w: 0, r: 12, done: true }] }])] })
    const line = cards(render())[0].querySelector('.g-xrow-b > span').textContent
    expect(line).not.toContain('est.')
  })

  it('give way to one list ranked by the search, yours first', () => {
    seed({ workouts: [day(9, [{ id: BENCH, target: { mode: 'reps' }, sets: sets(2) }])] })
    const host = render()
    search(host, 'bench press')
    expect(titles(host).some(x => x === 'Your exercises')).toBe(false)
    expect(titles(host)[0]).toMatch(/exercises$/)
    expect(nameOf(cards(host)[0].querySelector('.g-xrow')).toLowerCase()).toBe(EXIDX[BENCH].n.toLowerCase())
  })

  it('a tap opens the exercise\'s drawer', () => {
    const host = render()
    act(() => host.querySelector('.g-xrow').click())
    expect(exerciseDetailSheet).toHaveBeenCalledTimes(1)
    expect(vi.mocked(exerciseDetailSheet).mock.calls[0][0].id).toBeTruthy()
  })
})

describe('Exercises similar matches', () => {
  const label = host => titles(host).find(x => x === 'Similar exercises' || x.startsWith('No exact match')) || null

  it('offers what comes close instead of "No match" when nothing matches exactly', () => {
    const host = render()
    search(host, 'dumbbell curl qwxz')
    expect(label(host)).toBe('No exact match. These come close:')
    expect(host.textContent).not.toContain('No match')
    expect(names(host).slice(0, 5).some(n => /dumbbell.*curl/i.test(n))).toBe(true)
  })

  it('says "No match" when not even a similar exercise comes close', () => {
    const host = render()
    search(host, 'qxzvwjkq')
    expect(label(host)).toBeNull()
    expect(host.querySelector('.g-sempty b').textContent).toBe('No match')
  })

  it('lists similar ones under a short result list, without repeating a result', () => {
    const host = render()
    search(host, 'face pull')
    expect(label(host)).toBe('Similar exercises')
    const all = names(host)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('Exercises filter drawers', () => {
  it('Any equipment opens a drawer of the equipment left, and choosing one filters and closes it', () => {
    const host = render()
    expect(chip(host, 'Any equipment').getAttribute('aria-haspopup')).toBe('dialog')
    act(() => chip(host, 'Any equipment').click())
    const sheet = drawer()
    expect(sheet.querySelector('[role="radiogroup"]')).not.toBeNull()
    expect(radio(sheet, 'Any equipment').getAttribute('aria-checked')).toBe('true')
    expect(radio(sheet, 'Barbell')).toBeTruthy()
    act(() => radio(sheet, 'Barbell').click())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(chip(host, 'Barbell')).toBeTruthy()
    expect(chip(host, 'Barbell').classList.contains('on')).toBe(true)
    expect(host.querySelector('.g-ssf-count').textContent).toBe(String(EXDB.filter(e => e.eq === 'barbell').length))
  })

  it('Any type opens the kinds of exercise, and "Any type" clears the choice', () => {
    const host = render()
    act(() => chip(host, 'Any type').click())
    const sheet = drawer()
    expect(radio(sheet, 'Stretching')).toBeTruthy()
    act(() => radio(sheet, 'Stretching').click())
    expect(chip(host, 'Stretching')).toBeTruthy()
    expect(host.querySelector('.g-ssf-count').textContent).toBe(String(EXDB.filter(e => e.cat === 'stretching').length))
    act(() => chip(host, 'Stretching').click())
    // the drawer is drawn outside act(), which would not flush a render nested in it
    const again = drawer()
    act(() => radio(again, 'Any type').click())
    expect(chip(host, 'Any type')).toBeTruthy()
    expect(host.querySelector('.g-ssf-count')).toBeNull()
  })

  it('the active gym profile is the first choice of the equipment drawer, and "Any equipment" shows everything', () => {
    const profile = { ...newProfile('Home gym'), id: 'p1', equipment: ['dumbbell'] }
    seed({ equipProfiles: [profile], activeEquipId: 'p1', equipFilterOn: true })
    const host = render()
    search(host, 'press')
    const within = Number(host.querySelector('.g-ssf-count').textContent)
    expect(chip(host, 'Home gym').classList.contains('on')).toBe(true)
    act(() => chip(host, 'Home gym').click())
    const sheet = drawer()
    expect(radios(sheet)[0].textContent).toBe('What you have in Home gym')
    expect(radios(sheet)[0].getAttribute('aria-checked')).toBe('true')
    act(() => radio(sheet, 'Any equipment').click())
    expect(chip(host, 'Any equipment').classList.contains('on')).toBe(false)
    expect(Number(host.querySelector('.g-ssf-count').textContent)).toBeGreaterThan(within)
    act(() => chip(host, 'Any equipment').click())
    const again = drawer()
    act(() => radios(again)[0].click())
    expect(chip(host, 'Home gym')).toBeTruthy()
    expect(Number(host.querySelector('.g-ssf-count').textContent)).toBe(within)
  })

  it('keeps the equipment choice when the body part changes, and "All" clears it (#71)', () => {
    const host = render()
    act(() => bodyPart(host, 'Lower arms').click())
    act(() => chip(host, 'Any equipment').click())
    const sheet = drawer()
    act(() => radio(sheet, 'Dumbbell').click())
    expect(chip(host, 'Dumbbell').classList.contains('on')).toBe(true)
    act(() => bodyPart(host, 'Upper arms').click())
    expect(chip(host, 'Dumbbell').classList.contains('on')).toBe(true)
    act(() => bodyPart(host, 'All').click())
    expect(chip(host, 'Any equipment')).toBeTruthy()
  })
})

describe('Exercises: Browse by muscle, create, and the ends of the list', () => {
  it('the Browse by muscle card goes to the muscle page, and hides while the list is narrowed', () => {
    const host = render()
    const card = host.querySelector('.g-xs-mcard')
    expect(card.textContent).toContain('Browse by muscle')
    search(host, 'curl')
    expect(host.querySelector('.g-xs-mcard')).toBeNull()
    search(host, '')
    act(() => host.querySelector('.g-xs-mcard').click())
    expect(host.querySelector('#where').textContent).toBe('/train/exercises/muscles')
  })

  it('the + in the bar makes an exercise of your own', () => {
    const host = render()
    act(() => host.querySelector('.g-snav button[aria-label="Create exercise"]').click())
    expect(host.querySelector('#where').textContent).toBe('/train/exercises/new')
  })

  it('Create your own closes the list, and carries what you searched for as the name', () => {
    const host = render()
    expect(host.querySelector('.g-xs-more')).not.toBeNull()
    expect([...host.querySelectorAll('.g-glist-row b')].some(b => b.textContent === 'Create your own')).toBe(false)
    search(host, 'qxzvwjkq')
    const create = [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b').textContent === 'Create your own')
    act(() => create.click())
    expect(host.querySelector('#where').textContent).toBe('/train/exercises/new?name=qxzvwjkq')
  })

  it('Show more adds the next 40 rows, and the button goes once all are shown', () => {
    const host = render()
    expect(host.querySelectorAll('.g-xrow')).toHaveLength(40)
    act(() => host.querySelector('.g-xs-more').click())
    expect(host.querySelectorAll('.g-xrow')).toHaveLength(80)
    act(() => bodyPart(host, 'Neck').click())
    const neck = EXDB.filter(e => e.bp === 'neck').length
    expect(host.querySelectorAll('.g-xrow')).toHaveLength(Math.min(40, neck))
    expect(host.querySelector('.g-xs-more') === null).toBe(neck <= 40)
  })
})
