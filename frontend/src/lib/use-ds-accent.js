import { useStore } from '../store/useStore.js'
import { dsAccentFor } from './ds-accent.js'

// The design system preset for the person's accent, from the store: what a .g-root's data-accent
// takes (StageScreen `accent`, the tab bar). A string, so a store write that leaves the accent
// alone does not re-render the caller.
export const useDsAccent = () => useStore(s => dsAccentFor(s.S))
