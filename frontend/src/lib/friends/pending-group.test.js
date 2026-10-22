// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { groupCodeOf, pendingGroupCode, rememberPendingGroup, takePendingGroup } from './pending-group.js'

beforeEach(() => {
  sessionStorage.clear()
  location.hash = ''
})

describe('pending group link', () => {
  it('reads the code of a /g/<code> path', () => {
    expect(groupCodeOf('/g/k7Qp9x2Lm')).toBe('k7Qp9x2Lm')
    expect(groupCodeOf('/g/k7Qp9x2Lm/')).toBe('k7Qp9x2Lm')
    expect(groupCodeOf('/me/groups')).toBeNull()
    expect(groupCodeOf('/g/ab')).toBeNull()
  })

  it('keeps a code for the tab and forgets it once taken', () => {
    expect(pendingGroupCode()).toBeNull()
    rememberPendingGroup('k7Qp9x2Lm')
    expect(pendingGroupCode()).toBe('k7Qp9x2Lm')
    expect(takePendingGroup()).toBe('k7Qp9x2Lm')
    expect(pendingGroupCode()).toBeNull()
    expect(takePendingGroup()).toBeNull()
  })

  it('reads the code from the address before anything is stored', () => {
    location.hash = '#/g/k7Qp9x2Lm'
    expect(pendingGroupCode()).toBe('k7Qp9x2Lm')
  })
})
