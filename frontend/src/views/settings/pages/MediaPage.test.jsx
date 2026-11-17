// @vitest-environment happy-dom
// Settings > Photos & videos: the "waiting to upload" line counts what is really waiting
// (waitingRefCount), not the progress photos a person keeps on this device by choice, which
// pendingRefCount still counts for sign-out.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'

const owed = vi.hoisted(() => ({
  pendingRefCount: vi.fn(() => 5),
  waitingRefCount: vi.fn(() => 2),
  getMediaStatus: (status => () => status)({ usage: null, pending: 0 }),
  subscribeMediaStatus: () => () => {},
}))
vi.mock('../../../lib/media-owed.js', () => owed)
vi.mock('../../../lib/media-sync.js', () => ({ syncMedia: vi.fn() }))

import MediaPage from './MediaPage.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
const mount = async () => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<MediaPage />) })
}

beforeEach(() => {
  useStore.setState({ user: { id: 1, name: 'Ana' }, config: { media: true } })
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('Photos & videos', () => {
  it('says how many are waiting to upload, leaving out the photos kept on this device', async () => {
    await mount()
    expect(host.textContent).toContain('2 waiting to upload')
    expect(host.textContent).not.toContain('5 waiting to upload')
  })

  it('says nothing is waiting when only the held-back photos are owed', async () => {
    owed.waitingRefCount.mockReturnValueOnce(0)
    await mount()
    expect(host.textContent).not.toContain('waiting to upload')
  })
})
