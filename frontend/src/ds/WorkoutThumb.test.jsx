// @vitest-environment happy-dom
// WorkoutThumb: the still, or the exercise's animation when the caller gives one (Animations: Full).
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import WorkoutThumb from './WorkoutThumb.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('WorkoutThumb', () => {
  it('shows the still when it has no clip', () => {
    view.render(<WorkoutThumb image="/still/bench.webp" size="lg" />)
    expect(view.host.querySelector('video')).toBeNull()
    expect(view.host.querySelector('img').getAttribute('src')).toBe('/still/bench.webp')
  })

  it('plays a video clip muted and looping instead of the still', () => {
    view.render(<WorkoutThumb image="/still/bench.webp" clip="/clip/bench.mp4" size="lg" />)
    const video = view.host.querySelector('video')
    expect(video.getAttribute('src')).toBe('/clip/bench.mp4')
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
    expect(view.host.querySelector('img')).toBeNull()
  })

  it('shows an animated image clip as an image', () => {
    view.render(<WorkoutThumb image="/still/bench.webp" clip="/clip/bench.webp" />)
    expect(view.host.querySelector('video')).toBeNull()
    expect(view.host.querySelector('img').getAttribute('src')).toBe('/clip/bench.webp')
  })

  it('falls back to the still when the clip fails to load', () => {
    view.render(<WorkoutThumb image="/still/bench.webp" clip="/clip/bench.mp4" />)
    act(() => { view.host.querySelector('video').dispatchEvent(new Event('error')) })
    expect(view.host.querySelector('video')).toBeNull()
    expect(view.host.querySelector('img').getAttribute('src')).toBe('/still/bench.webp')
  })

  it('is the empty tile, not a broken image, when the still fails to load (an exercise with no media)', () => {
    view.render(<WorkoutThumb image="/still/12107.webp" size="lg" />)
    act(() => { view.host.querySelector('img').dispatchEvent(new Event('error')) })
    expect(view.host.querySelector('img')).toBeNull()
    expect(view.host.querySelector('span.g-wkimg-lg')).not.toBeNull()
  })

  it('keeps its size as an empty tile with neither', () => {
    view.render(<WorkoutThumb size="md" />)
    expect(view.host.querySelector('.g-wkimg-md')).not.toBeNull()
  })
})
