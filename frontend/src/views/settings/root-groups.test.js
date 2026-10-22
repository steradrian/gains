// @vitest-environment happy-dom
// Which rows the Settings root shows on which device (root-groups.js), where each goes, and the slots.
import { describe, expect, it } from 'vitest'
import { PAGES } from '../settings-pages.js'
import { ROOT_GROUPS, ROOT_ROW_SLOTS, rootGroups, rowPath } from './root-groups.js'

const ids = (ctx, slots) => rootGroups(ctx, slots).flatMap(g => g.rows.map(r => r.id))
const titles = ctx => rootGroups(ctx).map(g => g.title)

describe('rootGroups', () => {
  it('a guest in a browser: no food, no reminders, no admin', () => {
    const got = ids({ user: null, mobile: false }, undefined)
    expect(got).toEqual(['appearance', 'units', 'features', 'workout', 'schedule', 'equipment', 'coach', 'advanced', 'progress', 'backup', 'import', 'account', 'help', 'about'])
    expect(titles({ user: null })).toEqual(['Make it yours', 'Keep you on track', 'Training', 'Your data', 'Help'])
  })

  it('signed in on the web with nutrition: Food, Reminders; Admin only for admins', () => {
    const ctx = { user: { id: 'u' }, mobile: false, nutrition: true }
    expect(ids(ctx)).toContain('reminders')
    expect(ids(ctx).filter(id => ['goals', 'diary', 'water', 'foods', 'sources', 'categories', 'customUnits'].includes(id))).toHaveLength(7)
    expect(ids(ctx)).not.toContain('admin')
    expect(ids({ ...ctx, user: { id: 'u', admin: true } }).at(-1)).toBe('admin')
    expect(ids({ ...ctx, user: { id: 'u', admin: true }, demo: true })).not.toContain('admin')
  })

  it('Health Connect (Android) and Photos & videos show only when there is something for them', () => {
    expect(ids({ mobile: true, android: true, hasMedia: true })).toEqual(expect.arrayContaining(['health', 'media']))
    expect(ids({ mobile: true, android: false })).not.toContain('health')
  })

  it('Help has a row, for everyone, ahead of About', () => {
    for (const ctx of [{ user: { id: 'u' } }, { user: null }, { mobile: true }]) {
      const got = ids(ctx)
      expect(got).toContain('help')
      expect(got.indexOf('help')).toBeLessThan(got.indexOf('about'))
    }
  })

  it('every row names a real page, or has an address of its own', () => {
    for (const g of ROOT_GROUPS) for (const r of g.rows) expect(PAGES[r.id] || r.to || r.id === 'help', r.id).toBeTruthy()
  })

  it('rows go to /me/<page>, a tab address, or their own', () => {
    expect(rowPath({ id: 'appearance' })).toBe('/me/appearance')
    expect(rowPath({ id: 'goals' })).toBe('/food/goals')
    expect(rowPath({ id: 'progress', to: '/progress' })).toBe('/progress')
    expect(rowPath({ id: 'equipment' })).toBe('/me/equipment')
  })

  it('a slot row lands in its group, and a slot for a group with no rows creates none', () => {
    const groups = rootGroups({ user: null }, { yours: [{ id: 'groups', title: 'Groups', to: '/me/groups', visible: () => true }], track: [] })
    expect(groups[0].rows.map(r => r.id)).toEqual(['appearance', 'units', 'groups'])
    expect(groups.map(g => g.key)).not.toContain('track-empty')
  })

  it('has no Groups row: Friends puts it on the Me root', () => {
    expect(ROOT_ROW_SLOTS.track).toEqual([])
    expect(ids({ user: null })).not.toContain('groups')
  })
})
