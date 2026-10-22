import { describe, expect, it } from 'vitest'
import { fmtDate } from '../../../lib/format.js'
import {
  entryDetail, entryTitle, failureMessage, groupByDay, isAlready, restoredMessage, timeOf, weekdayName,
} from './changes-data.js'

// Wed 21 Oct 2026, 12:00 local.
const NOW = new Date(2026, 9, 21, 12, 0).getTime()
const at = (m, d, hh = 9, mm = 12) => new Date(2026, m - 1, d, hh, mm).getTime()
const entry = (kind, rest = {}) => ({ id: kind, kind, at: at(10, 21), day: '2026-10-21', subject: '', facts: {}, action: 'restore', state: 'open', ...rest })
const D = iso => fmtDate(iso, true)

describe('entryTitle and entryDetail, one formatter per kind', () => {
  it('food-delete: the food, then meal and day, kcal and the time', () => {
    const e = entry('food-delete', { subject: 'Oats with milk', facts: { meal: 'Breakfast', day: '2026-10-18', kcal: 380, time: '09:12' } })
    expect(entryTitle(e)).toBe('Deleted Oats with milk')
    expect(entryDetail(e)).toBe(`Breakfast, ${D('2026-10-18')} · 380 kcal · 09:12`)
  })

  it('weighin-edit: the day, from and to in the unit, the time', () => {
    const e = entry('weighin-edit', { day: '2026-10-11', at: at(10, 11, 8, 5), facts: { from: 81.8, to: 81.7, unit: 'kg' } })
    expect(entryTitle(e)).toBe('Changed a weigh-in')
    expect(entryDetail(e)).toBe(`${D('2026-10-11')} · 81.8 → 81.7 kg · 08:05`)
  })

  it('weighin-edit falls back to the profile unit when the facts have none', () => {
    const e = entry('weighin-edit', { day: '2026-10-11', facts: { from: 180, to: 179.5 } })
    expect(entryDetail(e, { unit: 'lb' })).toContain('180 → 179.5 lb')
  })

  it('weighin-delete: the day and the weight', () => {
    const e = entry('weighin-delete', { day: '2026-10-16', facts: { weight: 82.1, unit: 'kg' } })
    expect(entryTitle(e)).toBe('Deleted a weigh-in')
    expect(entryDetail(e)).toBe(`${D('2026-10-16')} · 82.1 kg · 09:12`)
  })

  it('goal-change: each thing that changed, with the new value where there is one', () => {
    const goal = what => entry('goal-change', { facts: { what, from: 80, to: 77, unit: 'kg' } })
    expect(entryTitle(goal('target'))).toBe('Target weight changed to 77 kg')
    expect(entryTitle(entry('goal-change', { facts: { what: 'goal', from: 'lose', to: 'keep' } }))).toBe('Goal changed to Keep')
    expect(entryTitle(entry('goal-change', { facts: { what: 'goal', to: 1.1 } }))).toBe('Goal changed to Build')
    expect(entryTitle(goal('body'))).toBe('Body details changed')
    expect(entryTitle(goal('movement'))).toBe('Daily movement changed')
    expect(entryTitle(goal('targets'))).toBe('Daily targets changed')
    expect(entryTitle(entry('goal-change'))).toBe('Goal settings changed')
  })

  it('goal-change: the line says what moved, from the recorder’s facts', () => {
    const line = facts => entryDetail(entry('goal-change', { facts }))
    expect(line({ what: 'goal', from: 'lose', to: 'keep' })).toBe('Lose → Keep · 09:12')
    expect(line({ what: 'goal', from: null, to: 'build' })).toBe('Build · 09:12')
    expect(line({ what: 'target', from: 80, to: 77, unit: 'kg' })).toBe('80 kg → 77 kg · 09:12')
    expect(line({ what: 'target', from: 80, to: null, unit: 'kg' })).toBe('09:12')
    expect(line({ what: 'body', from: { heightCm: 170, birthYear: 1990, sex: 'male' }, to: { heightCm: 172, birthYear: 1990, sex: 'male' } })).toBe('170 cm → 172 cm · 09:12')
    expect(line({ what: 'body', from: { heightCm: 170, birthYear: 1990, sex: 'male' }, to: { heightCm: 170, birthYear: 1991, sex: 'female' } })).toBe('1990 → 1991 · Male → Female · 09:12')
    expect(line({ what: 'targets', from: { calories: 2400 }, to: { calories: 2300 } })).toMatch(/^2,?400 kcal → 2,?300 kcal · 09:12$/)
    expect(line({ what: 'movement', from: 'light', to: 'active' })).toBe('On my feet some of the day → Physical work · 09:12')
    expect(line({ what: 'movement', from: null, to: 'sedentary' })).toBe('Mostly sitting · 09:12')
    expect(line({ what: 'movement', from: 'light', to: 'nonsense' })).toBe('09:12')
    expect(line({})).toBe('09:12')
  })

  it('routine-delete: the name and how many exercises', () => {
    const e = entry('routine-delete', { subject: 'Legs deload', facts: { exercises: 5 } })
    expect(entryTitle(e)).toBe('Deleted routine Legs deload')
    expect(entryDetail(e)).toBe('5 exercises · 09:12')
    expect(entryDetail(entry('routine-delete', { facts: { exercises: 1 } }))).toBe('1 exercise · 09:12')
  })

  it('workout-delete: the name if it had one, the day and the sets', () => {
    const e = entry('workout-delete', { subject: 'Pull A', facts: { day: '2026-10-17', sets: 18 } })
    expect(entryTitle(e)).toBe('Deleted workout Pull A')
    expect(entryTitle(entry('workout-delete'))).toBe('Deleted a workout')
    expect(entryDetail(e)).toBe(`${D('2026-10-17')} · 18 sets · 09:12`)
  })

  it('set-delete: the exercise and day, then the load', () => {
    const e = entry('set-delete', { subject: 'Bench press', facts: { day: '2026-10-12', weight: 75, reps: 8 } })
    expect(entryTitle(e)).toBe('Deleted a set')
    expect(entryDetail(e, { unit: 'kg' })).toBe(`Bench press, ${D('2026-10-12')} · 75 kg × 8 · 09:12`)
    expect(entryDetail(entry('set-delete', { subject: 'Plank', facts: { day: '2026-10-12', weight: null, reps: 30 } }))).toBe(`Plank, ${D('2026-10-12')} · 30 reps · 09:12`)
  })

  it('coach-move: weekday names, never dates', () => {
    const moved = entry('coach-move', { subject: 'Legs', action: 'undo', facts: { change: 'moved', weekday: 1, from: 5, to: 1 } })
    expect(entryTitle(moved)).toBe('Coach moved Legs')
    expect(entryDetail(moved)).toBe(`${weekdayName(5)} → ${weekdayName(1)} · 09:12`)
    expect(weekdayName(1)).toMatch(/^Monday$/i)
    expect(entryTitle(entry('coach-move', { subject: 'Push A', facts: { change: 'set', to: 4 } }))).toBe(`Coach put Push A on ${weekdayName(4)}`)
    expect(entryTitle(entry('coach-move', { subject: 'Push A', facts: { change: 'rest-day', from: 3 } }))).toBe(`Coach made ${weekdayName(3)} a rest day`)
    expect(entryTitle(entry('coach-move', { subject: 'Core', facts: { change: 'added' } }))).toBe('Coach added Core')
    expect(entryTitle(entry('coach-move', { subject: 'Core', facts: { change: 'removed' } }))).toBe('Coach removed Core')
    const renamed = entry('coach-move', { subject: 'Push B', facts: { change: 'renamed', from: 'Push 2', to: 'Push B' } })
    expect(entryTitle(renamed)).toBe('Coach renamed a routine')
    expect(entryDetail(renamed)).toBe('Push 2 → Push B · 09:12')
  })

  it('an unknown kind from a newer version is a generic row, not a crash', () => {
    const e = entry('future-kind', { facts: { weird: true } })
    expect(entryTitle(e)).toBe('Changed something')
    expect(entryDetail(e)).toBe(timeOf(e.at))
  })

  it('leaves out what the data cannot back', () => {
    expect(entryDetail(entry('routine-delete'))).toBe('09:12')
    expect(entryDetail(entry('food-delete', { subject: 'Apple' }))).toBe('09:12')
  })
})

describe('groupByDay', () => {
  it('groups by the day it was made, newest first, with Today, Yesterday and a dated header', () => {
    const list = [
      entry('a', { id: 'a', at: at(10, 16, 18, 2) }),
      entry('b', { id: 'b', at: at(10, 21, 9, 12) }),
      entry('c', { id: 'c', at: at(10, 20, 21, 30) }),
      entry('d', { id: 'd', at: at(10, 21, 8, 5) }),
    ]
    const days = groupByDay(list, NOW)
    expect(days.map(d => d.label)).toEqual(['Today', 'Yesterday', D('2026-10-16')])
    expect(days.map(d => d.items.map(e => e.id))).toEqual([['b', 'd'], ['c'], ['a']])
  })

  it('is empty when there is nothing', () => {
    expect(groupByDay([], NOW)).toEqual([])
  })
})

describe('restore wording', () => {
  const food = entry('food-delete', { subject: 'Oats with milk', facts: { meal: 'Breakfast', day: '2026-10-18' } })

  it('names the day and the meal it went back to', () => {
    expect(restoredMessage(food, { ok: true, where: { day: '2026-10-18', meal: 'Breakfast' } })).toBe(`Restored Oats with milk to ${D('2026-10-18')}, Breakfast`)
  })

  it('says so when the meal was deleted and the food went to Snacks', () => {
    expect(restoredMessage(food, { ok: true, where: { day: '2026-10-18', meal: 'snacks' }, fellBack: 'snacks' }))
      .toBe(`Restored Oats with milk to ${D('2026-10-18')}, Snacks. Breakfast was deleted.`)
  })

  it('words the other kinds', () => {
    expect(restoredMessage(entry('routine-delete', { subject: 'Legs deload' }))).toBe('Restored Legs deload')
    expect(restoredMessage(entry('set-delete'))).toBe('Restored the set')
    expect(restoredMessage(entry('workout-delete'), { ok: true, where: { day: '2026-10-17' } })).toBe(`Restored the workout on ${D('2026-10-17')}`)
    expect(restoredMessage(entry('coach-move', { action: 'undo' }), { ok: true })).toBe('Plan restored')
    expect(restoredMessage(entry('mystery'), { ok: true })).toBe('Restored')
  })

  it('gives the honest reason when it failed', () => {
    expect(failureMessage(entry('weighin-delete'), 'replaced')).toBe('Couldn’t restore: that day already has a weigh-in')
    expect(failureMessage(entry('workout-delete'), 'gone')).toBe('Couldn’t restore: the workout is gone')
    expect(failureMessage(food, 'changed')).toBe('Couldn’t restore: it changed since')
    expect(failureMessage(food, 'error')).toBe('Couldn’t restore. Check your connection and try again.')
    expect(failureMessage(entry('coach-move', { action: 'undo' }), 'gone')).toBe('Couldn’t undo: there’s nothing to undo')
  })

  it('reads replaced and restored as already back, except for a weigh-in whose day has another reading', () => {
    expect(isAlready(entry('routine-delete'), 'replaced')).toBe(true)
    expect(isAlready(entry('food-delete'), 'restored')).toBe(true)
    expect(isAlready(entry('weighin-edit'), 'replaced')).toBe(false)
    expect(isAlready(entry('weighin-edit'), 'restored')).toBe(true)
    expect(isAlready(entry('routine-delete'), 'gone')).toBe(false)
  })
})
