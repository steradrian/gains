import { describe, expect, it } from 'vitest'
import { togetherOf } from './use-together.js'

// The Trained together moments that hold the viewer's workout: kind together, the viewer among
// `who`, on the workout's day; nothing else becomes a row.
const GROUP = {
  id: 'g1',
  members: [{ uid: 'u1', name: 'Adrian', you: true }, { uid: 'u2', name: 'Ioana' }, { uid: 'u3', name: 'Mara' }],
  moments: [
    { id: 'm1', kind: 'together', who: ['u1', 'u2'], at: '2026-10-18T19:10:00' },
    { id: 'm2', kind: 'together', who: ['u2', 'u3'], at: '2026-10-18T19:10:00' },
    { id: 'm3', kind: 'workout', who: ['u1'], at: '2026-10-18T19:10:00' },
    { id: 'm4', kind: 'together', who: ['u1', 'u3'], at: '2026-10-17T19:10:00' },
    { id: 'm5', kind: 'together', who: ['u1', 'u3'], at: '2026-10-18' },
  ],
}

describe('togetherOf', () => {
  it('keeps the together moments of the viewer on that day, with the other people\'s names', () => {
    expect(togetherOf(GROUP, '2026-10-18')).toEqual([
      { gid: 'g1', mid: 'm1', names: ['Ioana'] },
      { gid: 'g1', mid: 'm5', names: ['Mara'] },
    ])
  })

  it('is empty when there is no such moment, no day or no viewer in the group', () => {
    expect(togetherOf(GROUP, '2026-10-01')).toEqual([])
    expect(togetherOf(GROUP, null)).toEqual([])
    expect(togetherOf({ ...GROUP, members: GROUP.members.map(m => ({ ...m, you: false })) }, '2026-10-18')).toEqual([])
    expect(togetherOf({ id: 'g2' }, '2026-10-18')).toEqual([])
  })
})
