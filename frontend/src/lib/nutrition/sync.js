import { create } from 'zustand'
import { HubSync, nutritionAvailable } from './api.js'
import { useStore } from '../../store/useStore.js'

// The hub's openGym ↔ NutriTrace sync, as the app sees it: "sync now" after a workout or a
// weigh-in, so the workout's kcal and the weight reach NutriTrace without waiting for the hub's
// next poll, and its status for the avatar's dot.

// The hub states that need the person (fitness-hub src/sync/engine.ts SyncState).
const TROUBLE = new Set(['error', 'needs_confirmation', 'suspended'])

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<{ status: import('./api.js').SyncStatus|null }>>} */
export const useHubSync = create(() => ({ status: null }))
export const isHubTrouble = status => TROUBLE.has(status?.state)
export const useHubTrouble = () => useHubSync(s => isHubTrouble(s.status))

const available = () => nutritionAvailable(useStore.getState().user)

/** Reads the hub's sync status into useHubSync. Null when unavailable or unreachable. */
export async function refreshHubStatus() {
  if (!available()) return null
  try {
    const status = await HubSync.status()
    useHubSync.setState({ status })
    return status
  } catch {
    return null
  }
}

/**
 * Asks the hub to sync now. The change goes to openGym's server first (the hub reads it from
 * there), then the hub runs a cycle (it waits up to 8 s) and answers with its status.
 * Never throws: a sync that does not happen now happens on the hub's next poll.
 * @returns {Promise<import('./api.js').SyncStatus|null>}
 */
export async function syncNow() {
  if (!available()) return null
  try { await useStore.getState().pushState() } catch { /* the store keeps it owed and retries */ }
  try {
    const status = await HubSync.now()
    useHubSync.setState({ status })
    return status
  } catch {
    return null
  }
}

/** The kcal row the hub keeps for a workout (call after syncNow), or null.
 *  @returns {Promise<import('./api.js').WorkoutSyncStatus|null>} */
export async function workoutSyncRow(workoutId) {
  if (!available() || workoutId == null) return null
  try { return await HubSync.workout(String(workoutId)) } catch { return null }
}
