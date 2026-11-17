import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeSource } from './scan-web.js'

const NO_TORCH = { available: false, on: false }

/**
 * The browser's live code reader: opens the rear camera into the <video> of `video`, decodes a
 * frame every ~150 ms until a code shows up, then hands { value, fmt } to `onFound` and lets the
 * camera go. Runs while `enabled`; unmounting, disabling or the tab being hidden releases the
 * camera, and a tab that comes back resumes.
 *
 * `product` reads EAN/UPC product barcodes instead of QR cards. A product barcode has a 1-in-10
 * chance of passing its check digit by luck, so a single read of a smudged or half-seen code can
 * name the wrong product: it is taken once two reads inside 1.5 s agree. A QR card carries its own
 * error correction and goes at once.
 *
 * Returns
 *   error   null, 'denied' (the person or the browser said no) or 'unavailable' (no camera, or no
 *           getUserMedia)
 *   retry   asks for the camera again after an error
 *   torch   { available, on, toggle }: only a camera that reports a torch gets one
 */
export function useCameraScan({ video, enabled = true, product = false, onFound }) {
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [torch, setTorch] = useState(NO_TORCH)
  const track = useRef(null)
  const found = useRef(onFound)
  useEffect(() => { found.current = onFound })

  useEffect(() => {
    if (!enabled) return undefined
    setError(null)
    let stream = null, timer = null, done = false, opening = false
    // Releases the camera and the loop; `begin` can open them again (the tab came back to the front).
    const release = () => {
      if (timer) clearTimeout(timer)
      timer = null
      if (stream) stream.getTracks().forEach(tr => tr.stop())
      stream = null
      track.current = null
      setTorch(NO_TORCH)
    }
    const stop = () => { done = true; release() }
    const reads = []
    const confirmed = code => {
      if (!product) return true
      const now = Date.now()
      reads.push({ value: code.value, at: now })
      while (reads[0].at < now - 1500) reads.shift()
      return reads.filter(r => r.value === code.value).length >= 2
    }
    const begin = async () => {
      if (opening || stream || done) return
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setError('unavailable'); return }
      opening = true
      let opened
      try {
        opened = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      } catch (e) {
        opening = false
        setError(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'unavailable')
        return
      }
      opening = false
      // Closed, or hidden again, while the camera was opening.
      if (done || document.visibilityState === 'hidden') { opened.getTracks().forEach(tr => tr.stop()); return }
      const v = video.current
      if (!v) { opened.getTracks().forEach(tr => tr.stop()); return }
      stream = opened
      track.current = opened.getVideoTracks?.()[0] ?? null
      setTorch({ available: !!track.current?.getCapabilities?.().torch, on: false })
      v.srcObject = stream
      try { await v.play() } catch (e) { /* autoplay policies; the loop below waits for frames */ }
      reads.length = 0
      const tick = async () => {
        if (done || !stream) return
        if (v.readyState >= 2) {
          let code = null
          try { code = await decodeSource(v, { product }) } catch (e) { /* keep trying */ }
          if (code && !done && stream && confirmed(code)) { stop(); found.current(code); return }
        }
        if (stream) timer = setTimeout(tick, 150)
      }
      tick()
    }
    // A hidden tab keeps the camera light on and burns battery decoding: let go, and resume on return.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') release()
      else begin()
    }
    document.addEventListener('visibilitychange', onVisibility)
    begin()
    return () => { document.removeEventListener('visibilitychange', onVisibility); stop() }
  }, [enabled, product, attempt, video])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  const torchOn = useRef(false)
  useEffect(() => { torchOn.current = torch.on }, [torch.on])
  const toggle = useCallback(async () => {
    const tr = track.current
    if (!tr) return
    const next = !torchOn.current
    try {
      await tr.applyConstraints({ advanced: [{ torch: next }] })
      torchOn.current = next
      setTorch(s => ({ ...s, on: next }))
    } catch (e) { /* the torch is a nicety: leave it as it was */ }
  }, [])

  return { error, retry, torch: { ...torch, toggle } }
}
