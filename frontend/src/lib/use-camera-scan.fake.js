import { vi } from 'vitest'

// A stand-in for lib/use-camera-scan.js in tests of the Scan overlay: no camera, and the test
// decides what it reads. Mock the module with it:
//   vi.mock('../lib/use-camera-scan.js', async () => ({ useCameraScan: (await import('../lib/use-camera-scan.fake.js')).fakeCamera }))
// then `seeCode('3017620422003')` is the camera reading that code, `camera.error = 'denied'` is a
// blocked camera and `camera.torch.available = true` a camera with a torch.
export const camera = {
  opts: null,
  error: null,
  retry: vi.fn(),
  torch: { available: false, on: false, toggle: vi.fn() },
}

export const resetCamera = () => {
  camera.opts = null
  camera.error = null
  camera.retry = vi.fn()
  camera.torch = { available: false, on: false, toggle: vi.fn() }
}

export const fakeCamera = opts => {
  camera.opts = opts
  return { error: camera.error, retry: camera.retry, torch: camera.torch }
}

/** The camera reads a code. Wrap in act(). */
export const seeCode = (value, fmt = 'ean13') => camera.opts.onFound({ value, fmt })
