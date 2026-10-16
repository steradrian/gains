// A stand-in for the Web Animations API, for tests (happy-dom has none), handed to
// setMotionDriver: every animate() call is recorded with its keyframes and options, and runs
// until the test finishes or cancels it.
export function fakeMotionDriver() {
  const calls = []
  const animate = (el, keyframes, options) => {
    let resolve, reject
    const finished = new Promise((res, rej) => { resolve = res; reject = rej })
    const anim = {
      el, keyframes, options, finished, playState: 'running', reversed: false,
      finish() { if (anim.playState !== 'running') return; anim.playState = 'finished'; resolve(anim) },
      cancel() { if (anim.playState !== 'running') return; anim.playState = 'idle'; reject(new Error('AbortError')) },
      commitStyles() {},
      reverse() { anim.reversed = !anim.reversed },
    }
    calls.push(anim)
    return anim
  }
  return {
    calls,
    animate,
    running: () => calls.filter(a => a.playState === 'running'),
    on: el => calls.filter(a => a.el === el),
  }
}
