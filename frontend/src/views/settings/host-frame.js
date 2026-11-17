import { createContext } from 'react'

// SettingsPageHost provides the callback; a page drawn in SettingsPage calls it, so the host drops
// the old header it draws for pages not yet moved onto the stage frame.
export const HostFrameContext = createContext(null)
