// @vitest-environment happy-dom
// A thumbnail by exercise id: the catalogue's still, or a custom exercise's own poster (finding 26:
// the list thumbnails drew a dumbbell for every custom exercise, whatever picture it carried).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ExerciseStillImg from './ExerciseStillImg.jsx'
import RoutineTiles from '../ds/RoutineTiles.jsx'
import StageTrainCard from '../ds/StageTrainCard.jsx'
import { registerCustom } from '../lib/exercises.js'
import { createMediaStore, memoryBackend, _setMediaStore } from '../lib/media-store.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const POSTER = 'b'.repeat(64)
const poster = { hash: POSTER, mime: 'image/webp', size: 3, width: 48, height: 36 }
const mine = { id: 'c1', n: 'sandbag carry', bp: 'back', custom: true, media: { kind: 'image', hash: 'a'.repeat(64), mime: 'image/webp', size: 3, width: 80, height: 60, poster, at: 1 } }
const bare = { id: 'c2', n: 'plain custom', bp: 'back', custom: true }

let host, root
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const mount = async el => { act(() => root.render(el)); await settle() }

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  registerCustom([mine, bare])
  _setMediaStore(createMediaStore(memoryBackend(), { objectURL: { createObjectURL: () => 'blob:t/1', revokeObjectURL: () => {} } }))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  registerCustom([])
  _setMediaStore(null)
})

describe('ExerciseStillImg', () => {
  it('draws a catalogue exercise\'s still', async () => {
    await mount(<ExerciseStillImg id="0025" size="40" />)
    const img = host.querySelector('img')
    expect(img.getAttribute('src')).toMatch(/\.webp$/)
    expect(img.getAttribute('width')).toBe('40')
  })

  it('draws a custom exercise\'s own poster from the local store', async () => {
    const store = createMediaStore(memoryBackend(), { objectURL: { createObjectURL: () => 'blob:t/poster', revokeObjectURL: () => {} } })
    _setMediaStore(store)
    await store.put(POSTER, new Blob(['x']), { mime: 'image/webp', pending: false })
    await mount(<ExerciseStillImg id="c1" size="40" />)
    expect(host.querySelector('img').getAttribute('src')).toBe('blob:t/poster')
  })

  it('draws the dumbbell for a custom exercise with no picture, an unknown id or no id', async () => {
    for (const id of ['c2', 'gone', undefined]) {
      await mount(<ExerciseStillImg id={id} size="40" />)
      expect(host.querySelector('img')).toBeNull()
      expect(host.querySelector('i svg')).not.toBeNull()
    }
  })

  it('draws the caller\'s fallback in place of the dumbbell', async () => {
    await mount(<ExerciseStillImg id="c2" size="40" fallback={<b data-testid="fb" />} />)
    expect(host.querySelector('[data-testid="fb"]')).not.toBeNull()
    expect(host.querySelector('i')).toBeNull()
  })
})

describe('StageTrainCard and its rows with exercise ids', () => {
  it('draws the day card\'s stack from ids: a custom exercise with a poster shows it, one without a dumbbell', async () => {
    const store = createMediaStore(memoryBackend(), { objectURL: { createObjectURL: () => 'blob:t/poster', revokeObjectURL: () => {} } })
    _setMediaStore(store)
    await store.put(POSTER, new Blob(['x']), { mime: 'image/webp', pending: false })
    await mount(<StageTrainCard eyebrow="Workout done" title="Push A" stills={['0025', 'c1', 'c2']} />)
    const slots = [...host.querySelectorAll('.g-tcard-stack > span')]
    expect(slots).toHaveLength(3)
    expect(slots[1].querySelector('img').getAttribute('src')).toBe('blob:t/poster')
    expect(slots[2].querySelector('img')).toBeNull()
    expect(slots[2].querySelector('i svg')).not.toBeNull()
  })

  it('draws a read-only day\'s rows from ids, a custom exercise with its poster', async () => {
    const store = createMediaStore(memoryBackend(), { objectURL: { createObjectURL: () => 'blob:t/poster', revokeObjectURL: () => {} } })
    _setMediaStore(store)
    await store.put(POSTER, new Blob(['x']), { mime: 'image/webp', pending: false })
    await mount(<StageTrainCard eyebrow="Sat 24 Oct" title="Legs" exercises={[{ id: 'c1', name: 'Sandbag carry', sub: '3 × 10' }, { id: 'c2', name: 'Plain custom' }]} />)
    const rows = [...host.querySelectorAll('.g-xrow')]
    expect(rows[0].querySelector('img').getAttribute('src')).toBe('blob:t/poster')
    expect(rows[1].querySelector('img')).toBeNull()
    expect(rows[1].querySelector('.g-xrow-ph')).not.toBeNull()
  })
})

describe('RoutineTiles with stills', () => {
  it('draws a stack of the exercises\' pictures (at most three) from their ids', async () => {
    await mount(<RoutineTiles items={[{ key: 'a', title: 'Push A', stills: ['0025', 'c2', '0025', '0025'], onClick: () => {} }]} />)
    expect(host.querySelectorAll('.g-rtile-stack > span')).toHaveLength(3)
    expect(host.querySelectorAll('.g-rtile-stack img')).toHaveLength(2)
    expect(host.querySelectorAll('.g-rtile-stack i svg')).toHaveLength(1)
  })
})
