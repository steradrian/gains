// The change journal (Me > Recent changes): the last 7 days of deletes and changes on this
// device, each with a snapshot and a Restore. Device-local and never synced (recent-changes-store.js).
//
// It holds no UI strings: `subject` is the person's own data ("Legs deload", "Bench press") and
// `facts` is structured; the screen words each kind. Each kind (lib/me/*-changes.js) records its
// entries at the place the change is made and registers a restorer; recent-changes-kinds.js
// imports them all.
//
//   Entry: { id, kind, at, day, subject, facts, snapshot, action, state: 'open' | 'restored', result? }
//
// A restore marks the entry `restored` and keeps it listed until the 7 days pass; undoRestore
// reverses it and the entry is `open` again. Recording is best effort and never throws, so a
// delete path never fails because the journal could not be written.
import { readEntries, removeEntries, writeEntries } from './recent-changes-store.js'

export const KEEP_DAYS = 7
const DAY_MS = 86400000

const restorers = new Map()
let readState = () => null
let counter = 0
// Entries being restored or un-restored right now: a second tap meets the first.
const busy = new Set()

/** How a restorer reads the current state `S`; set once by recent-changes-kinds.js. */
export const setStateReader = fn => { readState = fn }

/** `restore(snapshot, S)` and optionally `undo(snapshot, S, result)`, each (a)sync -> { ok, where?, fellBack?, reason? }. */
export const registerRestorer = (kind, restorer) => { restorers.set(kind, restorer) }

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
const pad = n => String(n).padStart(2, '0')
const isoOf = at => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fresh = (list, now) => list.filter(e => e.at > now - KEEP_DAYS * DAY_MS)
const publicOf = ({ snapshot: _snapshot, result: _result, media: _media, ...rest }) => rest

/**
 * Keeps the last 7 days. Writes only when something went. Returns what is left, newest first.
 */
export function pruneChanges(now = Date.now()) {
  const all = readEntries()
  const kept = fresh(all, now)
  if (kept.length !== all.length) writeEntries(kept)
  return kept
}

/**
 * Journals one change; returns its id, or null when it could not be kept (nothing throws).
 * `action` is what the screen offers: 'restore' (default) or 'undo'. `media` lists the blob
 * hashes the snapshot refers to: the local media clean-up keeps them while the entry lives
 * (journalMediaHashes).
 */
export function recordChange({ kind, day, subject, facts, snapshot, action = 'restore', media } = {}) {
  try {
    if (typeof kind !== 'string' || !kind) return null
    const at = Date.now()
    const entry = {
      id: `${at.toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      kind, at, day: typeof day === 'string' && day ? day : isoOf(at),
      subject: typeof subject === 'string' ? subject : '', facts: clone(facts) ?? {},
      snapshot: clone(snapshot) ?? null, action: action === 'undo' ? 'undo' : 'restore', state: 'open',
    }
    const hashes = Array.isArray(media) ? [...new Set(media.filter(h => typeof h === 'string' && h))] : []
    if (hashes.length) entry.media = hashes
    writeEntries([entry, ...pruneChanges(at)])
    return entry.id
  } catch { return null }
}

/** The last 7 days, newest first, without their snapshots. */
export function listChanges(now = Date.now()) {
  let own = []
  try { own = pruneChanges(now).map(publicOf) } catch { /* an unreadable journal lists nothing of its own */ }
  const read = sourceEntries(now)
  return read.length ? [...own, ...read].sort((a, b) => b.at - a.at) : own
}

function replaceEntry(id, patch) {
  writeEntries(readEntries().map(e => (e.id === id ? { ...e, ...patch } : e)))
}

/**
 * Runs the restorer of entry `id`. Marks the entry restored when it worked. Resolves with
 * { ok, where?, fellBack? } or { ok: false, reason }: 'gone' (no such entry, or what it
 * concerned is gone), 'restored' (already restored, or being restored), 'replaced' / 'changed'
 * (the restorer's own), 'unsupported' (no restorer registered), 'error'.
 */
export async function restoreChange(id) {
  const entry = pruneChanges().find(e => e.id === id)
  if (!entry) return restoreFromSource(id)
  if (entry.state === 'restored' || busy.has(id)) return { ok: false, reason: 'restored' }
  const restorer = restorers.get(entry.kind)
  if (!restorer?.restore) return { ok: false, reason: 'unsupported' }
  busy.add(id)
  try {
    const res = await restorer.restore(clone(entry.snapshot), readState())
    if (!res?.ok) return { ok: false, reason: res?.reason || 'error' }
    const { where, fellBack } = res
    replaceEntry(id, { state: 'restored', result: clone({ where, fellBack }) ?? null })
    return { ok: true, ...(where !== undefined ? { where } : {}), ...(fellBack !== undefined ? { fellBack } : {}) }
  } catch { return { ok: false, reason: 'error' } } finally { busy.delete(id) }
}

/** Reverses a restore with the restorer's `undo`; the entry is open again. */
export async function undoRestore(id) {
  const entry = pruneChanges().find(e => e.id === id)
  if (!entry || entry.state !== 'restored' || busy.has(id)) return { ok: false }
  const restorer = restorers.get(entry.kind)
  if (!restorer?.undo) return { ok: false, reason: 'unsupported' }
  busy.add(id)
  try {
    const res = await restorer.undo(clone(entry.snapshot), readState(), clone(entry.result))
    if (!res?.ok) return { ok: false, reason: res?.reason }
    replaceEntry(id, { state: 'open', result: null })
    return { ok: true }
  } catch { return { ok: false, reason: 'error' } } finally { busy.delete(id) }
}

/* ------------------------------------------------------------------ sources ----------------- */
// A source is a log that something else owns (the Coach's plan changes): the journal lists its
// entries but never copies them, so they cannot go stale, and clearChanges leaves them alone.

const sources = new Map()

/**
 * `read(S, now)` -> entries { id, at, day, subject, facts, action? } (the journal adds `kind`,
 * defaults `state: 'open'` and keeps only the last 7 days); `restore(entry, S)` runs the entry's
 * action -> { ok, where?, reason? }. A source has no undo of its restore: undoRestore answers
 * 'unsupported' for its entries.
 */
export const registerSource = (kind, read, { restore } = {}) => { sources.set(kind, { read, restore }) }

function readSource(kind, src, now) {
  try {
    const list = src.read(readState(), now)
    const from = now - KEEP_DAYS * DAY_MS
    return (Array.isArray(list) ? list : [])
      .filter(e => e && typeof e.id === 'string' && Number.isFinite(e.at) && e.at > from && e.at <= now)
      .map(e => ({ action: 'undo', subject: '', facts: {}, state: 'open', ...e, kind, day: e.day || isoOf(e.at) }))
  } catch { return [] }
}

function sourceEntries(now) {
  const out = []
  for (const [kind, src] of sources) out.push(...readSource(kind, src, now))
  return out
}

async function restoreFromSource(id) {
  const now = Date.now()
  for (const [kind, src] of sources) {
    const entry = readSource(kind, src, now).find(e => e.id === id)
    if (!entry) continue
    if (!src.restore) return { ok: false, reason: 'unsupported' }
    if (busy.has(id)) return { ok: false, reason: 'restored' }
    busy.add(id)
    try {
      const res = await src.restore(clone(entry), readState())
      if (!res?.ok) return { ok: false, reason: res?.reason || 'error' }
      const { where, fellBack } = res
      return { ok: true, ...(where !== undefined ? { where } : {}), ...(fellBack !== undefined ? { fellBack } : {}) }
    } catch { return { ok: false, reason: 'error' } } finally { busy.delete(id) }
  }
  return { ok: false, reason: 'gone' }
}

/** Every blob hash a live entry's snapshot refers to: what the local media clean-up must keep. */
export function journalMediaHashes(now = Date.now()) {
  const out = new Set()
  try {
    for (const e of pruneChanges(now)) for (const h of Array.isArray(e.media) ? e.media : []) out.add(h)
  } catch { /* nothing kept */ }
  return out
}

/**
 * Sign-out, switch account, Start over, delete account: the journal goes. Without an argument it
 * is the current profile's; `{ id }` names a signed-in account's, `null` the guest profile's.
 */
export function clearChanges(user) {
  try { removeEntries(user) } catch { /* nothing to clear */ }
}
