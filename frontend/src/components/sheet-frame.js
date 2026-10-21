import { createContext } from 'react'

// What the app's sheet frame (Modals.jsx) hands a design-system drawer (ds/BottomSheet.jsx) that
// draws its own scrim and panel: the refs and handlers that give those elements the frame's
// behaviour (presence motion, focus, drag to dismiss), the frame's dismiss and whether the sheet
// is locked, and `panes` (the drawer's sub-panels, components/sheet-panes.jsx). Null outside the
// frame: the drawer then draws itself, still (the kit, the gallery).
export const SheetFrameContext = createContext(null)

// What a drawer's sub-panel hands the ds/BottomSheet its content draws: `back` (the chevron, null
// when the panel is locked), `dismiss` (the × closes the whole drawer) and whether the drawer
// itself is locked (no ×). Null for a drawer's own first panel, which draws the whole drawer.
export const SheetPaneContext = createContext(null)
