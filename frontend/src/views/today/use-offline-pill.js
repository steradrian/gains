import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore.js'
import { connectionView, useOnline } from '../../components/ServerSync.jsx'

// How long "Saved" stays once the waiting changes landed, and how long "Syncing" may wait for the
// retry after the network came back before the pill says Offline again.
export const SAVED_MS = 2500
export const SYNC_MAX_MS = 15000

/** The pill's next phase ('idle' | 'offline' | 'syncing' | 'saved'). `off`: the connection is
 *  down (connectionView's 'off' tone: no network, or the server out of reach). `back`: the
 *  network returned during this spell offline, so the store's retry is on its way. Once the
 *  connection is up, a spell offline ends in Saved when the server holds everything, Syncing
 *  while a change still waits, and nothing for a refusal or an error (the banner says those). */
export function nextPhase(phase, { off, online, status, back }) {
  if (off) return online && back ? 'syncing' : 'offline'
  if (phase === 'idle' || phase === 'saved') return phase
  if (status === 'ok') return 'saved'
  if (status === 'pending' || status === 'held') return 'syncing'
  return 'idle'
}

/**
 * T1.14, the glass pill under Today's header: Offline with the changes this device holds for the
 * server (the store's unsyncedChanges, the count Settings shows), then Syncing, Saved, and gone.
 * Null while there is nothing to say; a device with no server never shows it.
 */
export function useOfflinePill() {
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  useStore(s => s.S)   // the count of waiting changes follows every edit
  const unsynced = useStore(s => s.unsyncedChanges)
  const online = useOnline()
  const off = !!user && connectionView(sync, { online })?.tone === 'off'
  const status = sync?.status
  const [phase, setPhase] = useState('idle')
  // The device had no network during this spell offline: once it has again, a still-down
  // connection is the retry on its way rather than a server out of reach.
  const wasDown = useRef(false)
  const offNow = useRef(off)
  offNow.current = off

  useEffect(() => {
    if (off && !online) wasDown.current = true
    setPhase(p => nextPhase(p, { off, online, status, back: wasDown.current }))
    if (!off) wasDown.current = false
  }, [off, online, status])

  useEffect(() => {
    if (phase === 'saved') {
      const tm = setTimeout(() => setPhase('idle'), SAVED_MS)
      return () => clearTimeout(tm)
    }
    if (phase === 'syncing') {
      const tm = setTimeout(() => { wasDown.current = false; setPhase(offNow.current ? 'offline' : 'idle') }, SYNC_MAX_MS)
      return () => clearTimeout(tm)
    }
  }, [phase])

  if (phase === 'idle') return null
  const owed = phase === 'offline' && typeof unsynced === 'function' ? unsynced() : null
  return { state: phase, waiting: owed?.count > 0 ? owed.count : 0 }
}
