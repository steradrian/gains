import { useStore } from '../store/useStore.js'
import { useColorMode } from './color-mode.js'
import { dsAccentFor } from './ds-accent.js'

// The design system preset for the person's accent, from the store and the resolved light or dark
// mode: what a .g-root's data-accent takes (StageScreen `accent`, the tab bar). A string, so a
// store write that leaves the accent alone does not re-render the caller. An accent never picked
// follows the mode.
export const useDsAccent = () => {
  const mode = useColorMode()
  return useStore(s => dsAccentFor(s.S, mode))
}
