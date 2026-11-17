// @vitest-environment happy-dom
// Cheers for you's rows: newest first, what each line says from the data alone, a week every other
// member cheered as one row (with a streak line only when the cheer carries one), and the group
// named per row only when there are several.
import { describe, expect, it } from 'vitest'
import { GROUP, GROUP_QUIET } from '../../dev/screens/states/friends-fixture.js'
import { cheerOf, cheerRows, cheerWhen } from './cheer-rows.js'

const NOW = new Date(2026, 9, 18, 21).getTime()
const HOUR = 3600000
const raw = (id, uid, name, kind, hoursAgo, extra = {}) => ({
  id, from: { uid, name }, group: { id: GROUP.id, name: GROUP.name }, kind, ref: id, at: new Date(NOW - hoursAgo * HOUR).toISOString(), ...extra,
})
const rowsOf = (list, groups = [GROUP]) => cheerRows(list.map(cheerOf), groups)

describe('cheerOf', () => {
  it('drops a row with no sender or no time, and turns the time into ms', () => {
    expect(cheerOf({ id: 'x', from: { uid: 'u' }, at: new Date(NOW).toISOString() })).toBeNull()
    expect(cheerOf({ id: 'x', from: { uid: 'u', name: 'Mara' }, at: 'not a date' })).toBeNull()
    expect(cheerOf(raw('c1', 'u-mara', 'Mara', 'moment', 1))).toMatchObject({ name: 'Mara', at: NOW - HOUR, groupId: GROUP.id, kind: 'moment' })
  })

  it('reads the group as an id or as an object', () => {
    expect(cheerOf({ ...raw('c1', 'u-mara', 'Mara', 'moment', 1), group: 'g9' })).toMatchObject({ groupId: 'g9', groupName: '' })
  })
})

describe('cheerRows', () => {
  it('lists newest first, whatever order the server sent', () => {
    const rows = rowsOf([
      raw('old', 'u-radu', 'Radu', 'moment', 9, { moment: 'workout', label: 'Legs' }),
      raw('new', 'u-mara', 'Mara', 'moment', 1, { moment: 'workout', label: 'Push A' }),
    ])
    expect(rows.map(r => r.text)).toEqual(['Mara cheered your Push A', 'Radu cheered your Legs'])
  })

  it('names a new best and keeps the detail as the board does', () => {
    const [row] = rowsOf([raw('c2', 'u-radu', 'Radu', 'moment', 3, { moment: 'best', label: 'Cable fly', detail: '20 kg x 12' })])
    expect(row).toMatchObject({ text: 'Radu cheered your new best Cable fly', detail: '20 kg x 12', initial: 'Radu' })
  })

  it('says only what it knows when there is no label', () => {
    expect(rowsOf([raw('c1', 'u-mara', 'Mara', 'moment', 1)])[0].text).toBe('Mara cheered you')
    expect(rowsOf([raw('c1', 'u-mara', 'Mara', 'moment', 1, { moment: 'best' })])[0].text).toBe('Mara cheered your new best')
  })

  it('a week that every other member cheered is one row with its streak', () => {
    const week = ['u-mara:Mara', 'u-radu:Radu', 'u-ioana:Ioana', 'u-vlad:Vlad'].map((p, i) => {
      const [uid, name] = p.split(':')
      return raw('w' + i, uid, name, 'week', 26 + i, { ref: 'week-1', streak: 4 })
    })
    const rows = rowsOf([raw('c1', 'u-mara', 'Mara', 'moment', 2, { moment: 'workout', label: 'Push A' }), ...week])
    expect(rows.map(r => r.text)).toEqual(['Mara cheered your Push A', 'Everyone cheered the week'])
    expect(rows[1].detail).toBe('Goal hit · 4 weeks in a row')
  })

  it('leaves the streak line out when the data has none', () => {
    const week = ['u-mara:Mara', 'u-radu:Radu', 'u-ioana:Ioana', 'u-vlad:Vlad'].map((p, i) => {
      const [uid, name] = p.split(':')
      return raw('w' + i, uid, name, 'week', 26, { ref: 'week-1' })
    })
    const [row] = rowsOf(week)
    expect(row).toMatchObject({ text: 'Everyone cheered the week', detail: '' })
  })

  it('when only some cheered the week, each is their own row and nobody is "everyone"', () => {
    const rows = rowsOf([raw('w1', 'u-mara', 'Mara', 'week', 26, { ref: 'week-1', streak: 4 }), raw('w2', 'u-radu', 'Radu', 'week', 27, { ref: 'week-1', streak: 4 })])
    expect(rows.map(r => r.text)).toEqual(['Mara cheered your week', 'Radu cheered your week'])
  })

  it('a two-person group never reads as "everyone": one cheer is a name', () => {
    const pair = { ...GROUP, memberCount: 2, members: GROUP.members.slice(0, 2) }
    expect(rowsOf([raw('w1', 'u-mara', 'Mara', 'week', 5, { ref: 'week-1' })], [pair])[0].text).toBe('Mara cheered your week')
  })

  it('gives each person the colour they have in the group', () => {
    const [row] = rowsOf([raw('c1', 'u-radu', 'Radu', 'moment', 1)])
    expect(row.tone).toBe('iris')
  })

  it('names the group on each row only when there are several', () => {
    const list = [raw('c1', 'u-mara', 'Mara', 'moment', 1, { moment: 'workout', label: 'Push A', detail: 'Sunday evening' })]
    expect(rowsOf(list, [GROUP])[0].detail).toBe('Sunday evening')
    expect(rowsOf(list, [GROUP, GROUP_QUIET])[0].detail).toBe('Iron Sunday · Sunday evening')
  })
})

describe('cheerWhen', () => {
  it('says how long ago within a day, the date after', () => {
    expect(cheerWhen(NOW - 2 * HOUR, NOW)).toMatch(/2/)
    expect(cheerWhen(NOW - 3 * 24 * HOUR, NOW)).not.toMatch(/ago/)
  })
})
