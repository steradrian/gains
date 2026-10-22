// @vitest-environment happy-dom
// The browser's live code reader, with the camera and the decoder mocked: frames are decoded until
// a code shows, which is handed over once, and the camera stops. A refused camera is an error the
// caller can retry, and the torch is offered only by a camera that reports one.
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const decode = vi.fn()
vi.mock('./scan-web.js', () => ({ decodeSource: (...args) => decode(...args) }))
import { useCameraScan } from './use-camera-scan.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, stopTrack, track, latest
const wait = async ms => { await act(async () => { await new Promise(r => setTimeout(r, ms)) }) }

function Probe({ onFound, product = true, enabled = true }) {
  const video = useRef(null)
  latest = useCameraScan({ video, enabled, product, onFound })
  return <video ref={video} />
}
const show = props => act(async () => { root.render(<Probe {...props} />) })

beforeEach(() => {
  decode.mockReset()
  stopTrack = vi.fn()
  track = { stop: stopTrack, getCapabilities: () => ({}), applyConstraints: vi.fn(async () => {}) }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [track], getVideoTracks: () => [track] })) },
  })
  Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { configurable: true, get: () => 4 })
  // happy-dom only takes a real MediaStream here; the test's stream is a stub.
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null })
  HTMLVideoElement.prototype.play = vi.fn(async () => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the camera reader in product mode', () => {
  it('takes a code only once two reads agree: one stray read of another code is not enough', async () => {
    decode.mockResolvedValueOnce({ value: '8001190000001', fmt: 'ean13' }).mockResolvedValue({ value: '3017620422003', fmt: 'ean13' })
    const onFound = vi.fn()
    await show({ onFound })
    await wait(500)
    expect(decode.mock.calls.length).toBeGreaterThanOrEqual(3)
    expect(onFound).toHaveBeenCalledTimes(1)
    expect(onFound).toHaveBeenCalledWith({ value: '3017620422003', fmt: 'ean13' })
  })

  it('asks the decoder for product barcodes, reports the first one once, and stops the camera', async () => {
    decode.mockResolvedValueOnce(null).mockResolvedValue({ value: '3017620422003', fmt: 'ean13' })
    const onFound = vi.fn()
    await show({ onFound })
    await wait(500)
    expect(decode).toHaveBeenCalledWith(expect.anything(), { product: true })
    expect(onFound).toHaveBeenCalledTimes(1)
    expect(stopTrack).toHaveBeenCalled()
  })

  it('a QR card goes at once, on the first read', async () => {
    decode.mockResolvedValue({ value: 'card-1', fmt: 'qr' })
    const onFound = vi.fn()
    await show({ onFound, product: false })
    await wait(300)
    expect(onFound).toHaveBeenCalledTimes(1)
  })

  it('says denied when the camera is refused, and Try again asks for it again', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('no'), { name: 'NotAllowedError' }))
    await show({ onFound: vi.fn() })
    await wait(20)
    expect(latest.error).toBe('denied')
    await act(async () => { latest.retry() })
    await wait(30)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
    expect(latest.error).toBeNull()
  })

  it('says unavailable when there is no camera to ask', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(Object.assign(new Error('none'), { name: 'NotFoundError' }))
    await show({ onFound: vi.fn() })
    await wait(20)
    expect(latest.error).toBe('unavailable')
  })

  it('does not open the camera while disabled', async () => {
    await show({ onFound: vi.fn(), enabled: false })
    await wait(30)
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('lets go of the camera while the tab is hidden and opens it again on return', async () => {
    decode.mockResolvedValue(null)
    const setVisibility = state => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    await show({ onFound: vi.fn() })
    await wait(30)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
    await act(async () => { setVisibility('hidden') })
    expect(stopTrack).toHaveBeenCalledTimes(1)
    const calls = decode.mock.calls.length
    await wait(400)
    expect(decode.mock.calls.length).toBeLessThanOrEqual(calls + 1)
    await act(async () => { setVisibility('visible') })
    await wait(30)
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('stops the camera when it goes away', async () => {
    decode.mockResolvedValue(null)
    await show({ onFound: vi.fn() })
    await wait(30)
    act(() => root.render(<div />))
    expect(stopTrack).toHaveBeenCalled()
  })
})

describe('the torch', () => {
  it('is offered only by a camera that reports one, and toggles through the track', async () => {
    decode.mockResolvedValue(null)
    await show({ onFound: vi.fn() })
    await wait(30)
    expect(latest.torch.available).toBe(false)
    act(() => root.render(<div />))
    track.getCapabilities = () => ({ torch: true })
    await show({ onFound: vi.fn() })
    await wait(30)
    expect(latest.torch.available).toBe(true)
    expect(latest.torch.on).toBe(false)
    await act(async () => { await latest.torch.toggle() })
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
    expect(latest.torch.on).toBe(true)
    await act(async () => { await latest.torch.toggle() })
    expect(track.applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] })
    expect(latest.torch.on).toBe(false)
  })

  it('stays as it was when the camera refuses the change', async () => {
    decode.mockResolvedValue(null)
    track.getCapabilities = () => ({ torch: true })
    track.applyConstraints = vi.fn(async () => { throw new Error('no') })
    await show({ onFound: vi.fn() })
    await wait(30)
    await act(async () => { await latest.torch.toggle() })
    expect(latest.torch.on).toBe(false)
  })
})
