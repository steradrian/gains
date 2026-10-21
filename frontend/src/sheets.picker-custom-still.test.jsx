// @vitest-environment happy-dom
// A custom exercise's own picture in the picker's rows (its poster, from the local media store),
// where the catalogue's exercises show their still; the tile only when it has none.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'

const POSTER = 'b'.repeat(64)
vi.mock('./lib/media-store.js', () => ({
  mediaStore: {
    ready: async () => {},
    persistent: true,
    url: async hash => (hash === 'b'.repeat(64) ? 'blob:own-poster' : null),
    release: () => {},
    subscribe: () => () => {},
  },
}))

const withPicture = {
  id: 'c_own', n: 'My cable fly', custom: true, bp: 'chest', tg: 'pectorals', eq: 'cable',
  media: { kind: 'image', hash: 'a'.repeat(64), mime: 'image/webp', size: 2048, width: 800, height: 600, poster: { hash: POSTER, mime: 'image/webp', size: 512, width: 240, height: 180 }, at: 1 },
}
const without = { id: 'c_bare', n: 'My bare move', custom: true, bp: 'chest', tg: 'pectorals', eq: 'cable' }

const mounted = []
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const rowNamed = (host, name) => [...host.querySelectorAll('.g-xrow')].find(r => r.querySelector('.g-xrow-b b')?.textContent === name)
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 0)) })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  const S = structuredClone(DEF)
  S.customEx = [withPicture, without]
  useStore.setState({ S, user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('custom exercise pictures in the picker', () => {
  it('a custom exercise with a picture shows its own; one without keeps the tile', async () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    await settle()
    expect(rowNamed(host, 'My cable fly').querySelector('img')?.getAttribute('src')).toBe('blob:own-poster')
    const bare = rowNamed(host, 'My bare move')
    expect(bare.querySelector('img')).toBeNull()
    expect(bare.querySelector('.g-xrow-ph')).not.toBeNull()
  })

  it('a catalogue exercise keeps its catalogue still', async () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    await settle()
    const builtin = [...host.querySelectorAll('.g-pk-item .g-xrow')].find(r => !/^My /.test(r.querySelector('.g-xrow-b b')?.textContent))
    const src = builtin.querySelector('img')?.getAttribute('src') || ''
    expect(src).not.toBe('')
    expect(src.startsWith('blob:')).toBe(false)
  })
})
