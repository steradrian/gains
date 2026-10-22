// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import './recent-changes-kinds.js'
import { listChanges, recordChange, restoreChange } from './recent-changes.js'
import { removeEntries } from './recent-changes-store.js'

vi.mock('./api.js', () => ({ api: vi.fn(() => Promise.resolve({})), beacon: vi.fn(), appBase: () => '/' }))

afterEach(() => { localStorage.clear(); removeEntries() })

describe('the kinds registry', () => {
  it('registers a restorer for every kind of Me changes M1', async () => {
    useStore.setState({ S: Object.assign(JSON.parse(JSON.stringify(DEF)), { routines: [], workouts: [] }), user: null })
    for (const kind of ['routine-delete', 'workout-delete', 'set-delete']) {
      const id = recordChange({ kind, snapshot: {} })
      // a restorer that exists answers for its own snapshot; 'unsupported' means none is registered
      const res = await restoreChange(id)
      expect(res).toEqual({ ok: false, reason: 'gone' })
    }
    expect(listChanges().map(r => r.state)).toEqual(['open', 'open', 'open'])
  })
})
