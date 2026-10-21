// @vitest-environment happy-dom
// PastSetsList (T7.1): a card per session with its sets worded by setLabel in every kind (loaded,
// timed, cardio), a "New best" mark on the set that set the record, the volume and 1RM under them,
// a page of twenty with Show more, and a tap that hands back the session's id.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exerciseHistory } from '../lib/exercise-history.js'
import { setLabel } from '../lib/history.js'
import PastSetsList from './PastSetsList.jsx'

const mocks = vi.hoisted(() => ({ S: null }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('./Icon.jsx', () => ({ default: props => React.createElement('span', { 'data-icon': props.name }) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const DAY = 86400000
const T0 = Date.UTC(2026, 0, 5, 10)
const iso = i => new Date(T0 + i * DAY).toISOString().slice(0, 10)
const at = (i, id, target, sets, name = 'Push A') => ({ id: 'w' + i, d: iso(i), start: T0 + i * DAY, name, entries: [{ id, target, sets }] })
const work = (w, r) => ({ w, r, done: true })

let root, host
afterEach(() => { act(() => root.unmount()); host.remove() })

function mount(workouts, id, props = {}, unit = 'kg') {
  mocks.S = { unit, workouts }
  const history = exerciseHistory(mocks.S, id, { limit: Infinity })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<PastSetsList exId={id} history={history} {...props} />))
  return history
}
const cards = () => [...host.querySelectorAll('.g-ps-card')]
const setsOf = card => [...card.querySelectorAll('.g-ps-sets li')].map(li => [...li.children].map(c => c.textContent))

describe('PastSetsList', () => {
  it('lists the sessions newest first with the date, the routine and a numbered row per set', () => {
    mount([
      at(0, 'bench', { mode: 'reps' }, [work(60, 5), work(60, 5)]),
      at(2, 'bench', { mode: 'reps' }, [work(70, 5)], 'Push B'),
    ], 'bench')
    expect(cards()).toHaveLength(2)
    expect(cards()[0].textContent).toContain('Push B')
    // the 70 beat the 60, so the newest session also carries its record mark
    expect(setsOf(cards()[0])).toEqual([['Set 1', '70×5', 'New best']])
    expect(setsOf(cards()[1])).toEqual([['Set 1', '60×5'], ['Set 2', '60×5']])
    expect(host.querySelector('.g-ps-count').textContent).toBe('2 sessions')
  })

  it('words a timed hold and a cardio set the way the rest of the app does', () => {
    mount([at(0, 'plank', { mode: 'time' }, [{ sec: 90, done: true }])], 'plank')
    expect(setsOf(cards()[0])).toEqual([['Set 1', setLabel('plank', { sec: 90 }, { mode: 'time' }, 'kmh')]])
    act(() => root.unmount()); host.remove()
    mount([at(0, 'run', { mode: 'cardio' }, [{ min: 30, speed: 10, done: true }])], 'run')
    expect(setsOf(cards()[0])[0][1]).toMatch(/^30 min @/)
  })

  it('marks "New best" on the set that set the record, once per record session', () => {
    mount([
      at(0, 'bench', { mode: 'reps' }, [work(60, 5)]),
      at(1, 'bench', { mode: 'reps' }, [work(60, 5), work(70, 5), work(70, 4)]),
      at(2, 'bench', { mode: 'reps' }, [work(65, 5)]),
      at(3, 'bench', { mode: 'reps' }, [work(75, 3)]),
    ], 'bench')
    const marks = cards().map(card => setsOf(card).map(row => row.includes('New best')))
    // newest first: the 75 beat the 70; the 65 beat nothing; the 70 beat the 60, on its second set;
    // the first session has nothing to beat
    expect(marks).toEqual([[true], [false], [false, true, false], [false]])
  })

  it('puts the volume and the estimated 1RM under the sets', () => {
    mount([at(0, 'bench', { mode: 'reps' }, [work(60, 5), work(60, 5)])], 'bench')
    expect(cards()[0].querySelector('.g-ps-tail').textContent).toMatch(/^Volume 600 kg · Est\. 1RM \d+/)
  })

  it('gives a legacy record with no sets its top set instead', () => {
    mount([{ ...at(0, 'bench', { mode: 'reps' }, []), entries: [{ id: 'bench', target: { mode: 'reps' }, sets: [], topW: 70 }] }], 'bench')
    expect(setsOf(cards()[0])).toEqual([])
    expect(cards()[0].querySelector('.g-ps-tail').textContent).toBe('Top set 70 kg')
  })

  // Two sessions logged before sets were kept: the 70 beat the 60 and has no set to carry the mark.
  it('puts a legacy record\'s New best on its top-set line', () => {
    const legacy = (i, topW) => ({ ...at(i, 'bench', { mode: 'reps' }, []), entries: [{ id: 'bench', target: { mode: 'reps' }, sets: [], topW }] })
    mount([legacy(0, 60), legacy(2, 70)], 'bench')
    const tail = cards()[0].querySelector('.g-ps-tail')
    expect(tail.textContent).toBe('Top set 70 kg New best')
    expect(tail.querySelector('.g-ps-pr').textContent).toBe('New best')
    expect(cards()[1].querySelector('.g-ps-pr')).toBeNull()
  })

  it('shows twenty sessions, then twenty more on Show more', () => {
    mount(Array.from({ length: 25 }, (_, i) => at(i, 'bench', { mode: 'reps' }, [work(50 + i, 5)])), 'bench')
    expect(cards()).toHaveLength(20)
    const more = host.querySelector('.g-ps-more')
    act(() => more.click())
    expect(cards()).toHaveLength(25)
    expect(host.querySelector('.g-ps-more')).toBeNull()
  })

  it('says so when nothing was logged', () => {
    mount([], 'bench')
    expect(host.textContent).toBe('No sessions logged yet')
    expect(cards()).toHaveLength(0)
  })

  it('is a glass list on the stage and a plain one in the drawer', () => {
    mount([at(0, 'bench', { mode: 'reps' }, [work(60, 5)])], 'bench')
    expect(cards()[0].classList.contains('g-glass')).toBe(true)
    expect(cards()[0].tagName).toBe('DIV')
    act(() => root.unmount()); host.remove()
    mount([at(0, 'bench', { mode: 'reps' }, [work(60, 5)])], 'bench', { tone: 'light' })
    expect(host.querySelector('.g-ps').classList.contains('g-ps-light')).toBe(true)
    expect(cards()[0].classList.contains('g-glass')).toBe(false)
  })

  it('makes each card a button that hands back the session id, only with onOpen', () => {
    const onOpen = vi.fn()
    mount([at(0, 'bench', { mode: 'reps' }, [work(60, 5)]), at(1, 'bench', { mode: 'reps' }, [work(65, 5)])], 'bench', { onOpen })
    expect(cards().every(c => c.tagName === 'BUTTON')).toBe(true)
    act(() => cards()[1].click())
    expect(onOpen).toHaveBeenCalledWith('w0')
  })
})
