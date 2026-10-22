// The day this bundle was built, "2026-10-22" (vite.config.js defines __BUILD_DATE__), or '' where
// nothing defined it (a tool that loads the source without Vite). About shows it beside the version.
export const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : ''
