// Rows other areas add to Settings > Features. FeaturesPage draws each as a switch row in the
// "Features" section, after AI Coach.
//
// A row is `{ key, icon, title, sub, checked, onChange, disabled? }`, the props of SwitchRow
// (pages/prefs-rows.jsx); `title` names the switch for a screen reader and must already be
// translated. The slot is called with `{ S, ctx, update }`: the profile state, the Settings ctx
// (use-settings-ctx.js) and the store's `update`.

/** Friends core-m1 returns its row here ("Groups under Me. Nothing is shared until you join one"). */
export const friendsRow = () => []
