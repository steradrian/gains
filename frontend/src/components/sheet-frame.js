import { createContext } from 'react'

// What the app's sheet frame (Modals.jsx) hands a design-system drawer (ds/BottomSheet.jsx) that
// draws its own scrim and panel: the refs and handlers that give those elements the frame's
// behaviour (presence motion, focus, drag to dismiss), the frame's dismiss and whether the sheet
// is locked. Null outside the frame: the drawer then draws itself, still (the kit, the gallery).
export const SheetFrameContext = createContext(null)
