import { useCallback, useEffect, useRef, useState } from 'react'

export const AUTOSAVE_MS = 400

/**
 * Saves as you type (decision 4: no Save button, no discard drawer). `schedule(value)` waits
 * AUTOSAVE_MS after the last change and then calls `write(value)` once with the newest value, so
 * a burst of keys is one write. Writes never overlap: a change that arrives while one is out
 * waits for it and is sent after. Leaving the page sends what is waiting at once (Back keeps
 * edits); `cancel()` drops it (the record was deleted).
 *
 * `write` resolves to `false` when it chose not to write (the form is not saveable yet) and throws
 * when the write failed. `state` is SavedIndicator's: 'idle' | 'syncing' | 'saved' | 'error'. A
 * failure keeps the value, and `retry()` sends it again with whatever came after.
 */
export function useAutosave(write, { initial = 'idle', delay = AUTOSAVE_MS, onError } = {}) {
  const [state, setState] = useState(initial)
  const writeRef = useRef(write)
  const errorRef = useRef(onError)
  const waiting = useRef({ has: false, value: null })
  const failed = useRef({ has: false, value: null })
  const timer = useRef(null)
  const running = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    writeRef.current = write
    errorRef.current = onError
  })

  const run = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (waiting.current.has) {
        const { value } = waiting.current
        waiting.current = { has: false, value: null }
        failed.current = { has: false, value: null }
        if (alive.current) setState('syncing')
        try {
          const wrote = await writeRef.current(value)
          if (alive.current && !waiting.current.has) setState(wrote === false ? 'idle' : 'saved')
        } catch (e) {
          // A newer value replaces the one that failed: it carries the same fields and more.
          failed.current = waiting.current.has ? { has: false, value: null } : { has: true, value }
          if (alive.current) setState('error')
          errorRef.current?.(e)
          break
        }
      }
    } finally {
      running.current = false
    }
  }, [])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    return run()
  }, [run])

  const schedule = useCallback(value => {
    waiting.current = { has: true, value }
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, delay)
  }, [delay, flush])

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    waiting.current = { has: false, value: null }
    failed.current = { has: false, value: null }
  }, [])

  const retry = useCallback(() => {
    if (failed.current.has && !waiting.current.has) waiting.current = failed.current
    return flush()
  }, [flush])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      flush()
    }
  }, [flush])

  return { state, schedule, flush, cancel, retry }
}
