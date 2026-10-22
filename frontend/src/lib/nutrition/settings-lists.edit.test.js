import { describe, expect, it } from 'vitest'
import { restoreCategory, restoreCustomUnit, updateCategory, updateCustomUnit } from './settings-lists.js'

describe('updateCategory', () => {
  it('edits in place, keeping the position and the shapes NutriTrace uses', () => {
    expect(updateCategory(['A', { name: 'B', label: 'x' }, 'C'], 'B', { name: 'B2', label: '' }).list).toEqual(['A', 'B2', 'C'])
    expect(updateCategory(['A', 'B'], 'A', { name: 'A', label: ' y ' }).list).toEqual([{ name: 'A', label: 'y' }, 'B'])
  })

  it('refuses another category\'s name, an empty name, a long label and a category that is gone', () => {
    expect(updateCategory(['A', 'B'], 'A', { name: 'B', label: '' })).toEqual({ error: 'duplicate' })
    expect(updateCategory(['A'], 'A', { name: ' ', label: '' })).toEqual({ error: 'name' })
    expect(updateCategory(['A'], 'A', { name: 'A', label: 'x'.repeat(17) })).toEqual({ error: 'label' })
    expect(updateCategory(['A'], 'Z', { name: 'Z', label: '' })).toEqual({ error: 'missing' })
  })

  it('keeping the same name is not a duplicate', () => {
    expect(updateCategory(['A', 'B'], 'A', { name: 'A', label: 'z' }).list).toEqual([{ name: 'A', label: 'z' }, 'B'])
  })
})

describe('restoreCategory', () => {
  it('puts a removed category back at its index', () => {
    expect(restoreCategory(['A', 'C'], { name: 'B', label: 'x' }, 1).list).toEqual(['A', { name: 'B', label: 'x' }, 'C'])
    expect(restoreCategory(['A'], 'B', 9).list).toEqual(['A', 'B'])
    expect(restoreCategory(['A'], 'B', -3).list).toEqual(['B', 'A'])
  })

  it('refuses a name that came back some other way', () => {
    expect(restoreCategory(['A', 'B'], 'B', 0)).toEqual({ error: 'duplicate' })
  })
})

describe('updateCustomUnit', () => {
  it('renames the full name and leaves the abbreviation, defaulting an empty name to it', () => {
    expect(updateCustomUnit([{ abbr: 'shot', full: 'shot' }], 'shot', { full: ' shot glass ' }).list).toEqual([{ abbr: 'shot', full: 'shot glass' }])
    expect(updateCustomUnit([{ abbr: 'shot', full: 'x' }], 'shot', { full: '' }).list).toEqual([{ abbr: 'shot', full: 'shot' }])
  })

  it('refuses a long name and a unit that is gone', () => {
    expect(updateCustomUnit([{ abbr: 'a', full: 'a' }], 'a', { full: 'y'.repeat(61) })).toEqual({ error: 'full' })
    expect(updateCustomUnit([], 'a', { full: 'b' })).toEqual({ error: 'missing' })
  })
})

describe('restoreCustomUnit', () => {
  it('puts a removed unit back at its index and refuses a repeat in any case', () => {
    expect(restoreCustomUnit([{ abbr: 'a', full: 'A' }, { abbr: 'c', full: 'C' }], { abbr: 'b', full: 'B' }, 1).list.map(u => u.abbr)).toEqual(['a', 'b', 'c'])
    expect(restoreCustomUnit([{ abbr: 'Shot', full: 'x' }], { abbr: 'shot', full: 'x' }, 0)).toEqual({ error: 'duplicate' })
  })
})
