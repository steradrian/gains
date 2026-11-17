// @vitest-environment happy-dom
// "Friends will see" on the summary: absent unless Friends is on, there is a group and training is
// shared; each switch writes exactly its field on the saved workout; "Push A done" is the one switch
// for share.off, and off turns the other rows off and removes nothing (there is no second switch
// for the same field); a new best shares the exercise id only; the Trained together
// row exists only when the server has the moment, and switching it writes this workout's
// share.together, never a removal for the group.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../ds/render.test-util.js'
import { DEF, useStore } from '../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ me: null, removeMoment: vi.fn() }))
vi.mock('../lib/friends/use-friends.js', () => ({ useFriendsMe: () => ({ me: mocks.me, on: !!mocks.me?.on }) }))
vi.mock('../lib/friends/api.js', async importActual => ({
  ...(await importActual()),
  removeMoment: (...a) => mocks.removeMoment(...a),
}))

import { __setMockTogether } from '../lib/friends/use-together.js'
import WorkoutShareBlock from './WorkoutShareBlock.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const W = {
  id: 'w1', d: '2026-10-18', start: Date.parse('2026-10-18T17:42:00'), end: Date.parse('2026-10-18T18:34:00'), name: 'Push A',
  prs: ['0227'], entries: [{ id: '0227', sets: [{ w: 20, r: 12, done: true }] }],
}
const BESTS = [{ id: '0227', name: 'Cable fly', kind: 'weight', text: '20 kg × 12 · best set ever' }]
const SHARE = { training: true, consistency: true, targets: true, bests: false }
const ME = (over = {}) => ({ on: true, share: SHARE, groups: [{ id: 'g1', name: 'Iron Sunday' }], ...over })
const TOGETHER = [{ gid: 'g1', mid: 'm1', names: ['Ioana'] }]

const view = useView()
const rec = () => useStore.getState().S.workouts[0]
const switchOf = label => [...view.host.querySelectorAll('[role="switch"]')].find(b => b.getAttribute('aria-label') === label)
const titles = () => [...view.host.querySelectorAll('[role="switch"]')].map(b => b.getAttribute('aria-label'))
const show = (props = {}) => act(async () => { view.root.render(<WorkoutShareBlock w={W} bests={BESTS} {...props} />) })
let undo = () => {}

beforeEach(() => {
  useStore.setState({ S: { ...clone(DEF), workouts: [clone(W)] }, user: null })
  mocks.me = ME()
  mocks.removeMoment.mockReset().mockResolvedValue({ ok: true })
  undo = __setMockTogether(TOGETHER)
})
afterEach(() => { undo() })

describe('when it shows', () => {
  it('shows nothing with Friends off, with no group, or with training not shared', async () => {
    for (const me of [ME({ on: false }), ME({ groups: [] }), ME({ share: { ...SHARE, training: false } }), null]) {
      mocks.me = me
      await show()
      expect(view.host.innerHTML).toBe('')
    }
  })

  it('has the title Friends will see and the group name for one group, and Friends for several', async () => {
    await show()
    expect(view.host.querySelector('h2').textContent).toBe('Friends will see')
    expect(view.host.textContent).toContain('Iron Sunday')
    mocks.me = ME({ groups: [{ id: 'g1', name: 'Iron Sunday' }, { id: 'g2', name: 'Sunday crew' }] })
    await show()
    expect(view.host.querySelector('h2').textContent).toBe('Friends')
    expect(view.host.textContent).not.toContain('Iron Sunday')
  })

  it('lists the rows in order and the caption verbatim', async () => {
    await show()
    expect(titles()).toEqual(['Push A done', 'Trained together with Ioana', 'New best: Cable fly'])
    expect(view.host.textContent).toContain('Each line is one choice for this workout only. Your defaults are in What you share.')
  })

  it('has no Trained together row when the server has no such moment', async () => {
    undo()
    undo = __setMockTogether([])
    await show()
    expect(titles()).toEqual(['Push A done', 'New best: Cable fly'])
  })

  it('has a row for each new best, and none when there is none', async () => {
    await show({ bests: [] })
    expect(titles()).toEqual(['Push A done', 'Trained together with Ioana'])
  })
})

describe('the defaults', () => {
  it('Push A done and Trained together are on, the new best is off, and nothing is stored', async () => {
    await show()
    expect(switchOf('Push A done').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('Trained together with Ioana').getAttribute('aria-checked')).toBe('true')
    expect(switchOf('New best: Cable fly').getAttribute('aria-checked')).toBe('false')
    expect('share' in rec()).toBe(false)
  })
})

describe('each choice writes exactly its field', () => {
  it('a new best writes the exercise id and no weight', async () => {
    await show()
    click(switchOf('New best: Cable fly'))
    expect(rec().share).toEqual({ best: ['0227'] })
    expect(rec().entries).toEqual(W.entries)
    expect(switchOf('New best: Cable fly').getAttribute('aria-checked')).toBe('true')
    click(switchOf('New best: Cable fly'))
    expect('share' in rec()).toBe(false)
  })

  it('Push A done off writes off: true, keeps the whole workout to yourself, disables the other rows and removes nothing', async () => {
    await show()
    click(switchOf('New best: Cable fly'))
    click(switchOf('Push A done'))
    expect(rec().share).toEqual({ off: true, best: ['0227'] })
    expect(view.host.textContent).toContain('Keeps the whole workout to yourself')
    expect(switchOf('New best: Cable fly').disabled).toBe(true)
    expect(switchOf('Trained together with Ioana').disabled).toBe(true)
    expect(switchOf('Trained together with Ioana').getAttribute('aria-checked')).toBe('false')
    expect(useStore.getState().S.workouts).toHaveLength(1)
    expect(rec().entries).toEqual(W.entries)
    click(switchOf('Push A done'))
    expect(rec().share).toEqual({ best: ['0227'] })
    expect(switchOf('New best: Cable fly').disabled).toBe(false)
    expect(view.host.textContent).toContain('52 min · no weights, no sets')
  })

  it('no two switches drive the same field', async () => {
    await show()
    const before = titles().map(l => switchOf(l).getAttribute('aria-checked'))
    for (const label of titles()) {
      click(switchOf(label))
      const after = titles().map(l => switchOf(l).getAttribute('aria-checked'))
      const flipped = titles().filter((l, i) => after[i] !== before[i])
      // Push A done off also greys Trained together (it covers the whole workout); nothing else moves.
      expect(flipped).toEqual(label === 'Push A done' ? ['Push A done', 'Trained together with Ioana'] : [label])
      click(switchOf(label))
    }
  })
})

describe('Trained together', () => {
  it('switching it off writes together: false on this workout only and removes nothing for the group', async () => {
    await show()
    click(switchOf('Trained together with Ioana'))
    expect(rec().share).toEqual({ together: false })
    expect(mocks.removeMoment).not.toHaveBeenCalled()
    expect(switchOf('Trained together with Ioana').getAttribute('aria-checked')).toBe('false')
    expect(switchOf('Trained together with Ioana').disabled).toBe(false)
    expect(view.host.textContent).toContain('Not shown in the group')
  })

  it('can be switched on again, which removes the field', async () => {
    await show()
    click(switchOf('Trained together with Ioana'))
    click(switchOf('Trained together with Ioana'))
    expect('share' in rec()).toBe(false)
    expect(switchOf('Trained together with Ioana').getAttribute('aria-checked')).toBe('true')
    expect(view.host.textContent).toContain('Ioana logged Push A the same day')
  })

  it('a workout already left out shows the row off, ready to switch back on', async () => {
    useStore.setState({ S: { ...clone(DEF), workouts: [{ ...clone(W), share: { together: false } }] } })
    await show()
    expect(switchOf('Trained together with Ioana').getAttribute('aria-checked')).toBe('false')
    expect(switchOf('Trained together with Ioana').disabled).toBe(false)
  })
})
