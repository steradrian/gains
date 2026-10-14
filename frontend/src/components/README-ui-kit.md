# UI kit

Build pages from these instead of hand-written markup and inline styles. Each primitive emits
today's exact classes and elements (locked by `layout.test.jsx`, `blocks.test.jsx`,
`sheet-layout.test.jsx`), so `index.css` stays the one source of styling. Spacing props are steps
on the space scale: 1…10 = 2, 4, 6, 8, 10, 12, 14, 16, 18, 22px. No primitive sets a page width:
that belongs to the shell (`#app`, `--page-w`).

| Instead of | Use (file) |
|---|---|
| `RootHeader` / `SubHeader` at the top of a routed view | `<Page root title sub>` / `<Page title sub action onBack>` (layout) |
| `<div style={{ height: 8 }} />` | `<Spacer size={4} />` (layout) |
| `<div className="row between" style={{ gap: 6 }}>` | `<Inline justify="between" gap={3} wrap align="baseline">` (layout) |
| a column of blocks with margins | `<Stack gap={6}>` (layout). Never around `.lrow` rows |
| `.card` + `row between` + `<h2 style={{ margin: 0 }}>` | `<Card title action tone="danger"\|"accent">` (blocks) |
| `.item > .grow > .tt + .ss`, `.chev` | `<ItemRow lead title subtitle trailing chevron onClick>` (blocks) |
| `.tiles > .tile > .l + .v` | `<Tiles><StatTile label icon value unit size="sm"\|"xs" onClick /></Tiles>` (blocks) |
| `.big` + `<span className="muted" style={{ fontSize: '1rem' }}>` | `<Stat value unit size="sm">` (blocks) |
| `.empty > .ico` (+ `strong`) | `<EmptyState icon title>text</EmptyState>` (blocks) |
| `<h4 className="sec">` | `<SectionTitle>` (blocks) |
| `.tag(.acc)(.nocap)` | `<Tag tone="acc"\|"dim" icon nocap>` (blocks) |
| `.chips > .chip(.on)` | `<ChipRow ref><Chip on nocap onClick /></ChipRow>` (blocks) |
| hand-built `.lrow` | `<Row>` in a `<Section>` (ui.jsx) |
| sheet `<h3>`, or `row between` + xmark | `<SheetHeader title sub onClose action>` (sheet-layout) |
| spacer + primary Button (+ spacer + more) | `<SheetActions gap={4}>buttons</SheetActions>` (sheet-layout) |

## Tokens and utilities (`src/ui-kit.css`, loaded after `index.css`)

- Space `--space-1`…`--space-10`; rhythm `--gap-list` (8), `--gap-row` / `--gap-block` (12),
  `--gap-section` (22).
- Type `--fs-caption` 12, `-footnote` 13, `-subhead` 15, `-callout` 16, `-body` 17, `-title3` 20,
  `-title2` 22, `-tile` 26, `-big` 30, `-large` 34; `--fw-regular` 400, `-medium` 500,
  `-semibold` 600, `-bold` 700.
- Layout `--tap-min` 44px, `--row-min` 46px, `--item-min` 60px (`--page-w`, `--pad` in index.css).
- Media `--on-media`, `--media-bg`, `--knob`: colours drawn over photos and video.
- Classes: `.ink-danger|warn|orange|acc|ok` (the `--*-ink` colours), `.stack`, `.g-N` (gap),
  `.sp-N` (height), `.mb-0`, `.mb-N`, `.m-0`, `.wrap`, `.jc-end`, `.ai-start|end|baseline|stretch`.
  A bare `.mb-N` loses to element rules like `.card h2` or `.sheet h3`; use the primitive.

A one-off value with no token (an odd px, a computed width) may stay inline. A genuinely new
layout gets its own class in its own stylesheet, never a new colour class.

## Guards (`src/ui-guards.test.js`, a ratchet)

A guard fails when a file's count rises above `src/ui-guards.baseline.json`, or a file not in the
baseline counts above 0. New files start at 0.

- **G1** static inline style objects (all-literal values). An object with an expression or a
  `--custom-property` is allowed.
- **G2** hex outside the `:root` theme rules of the existing stylesheets; hex in JSX.
- **G3** a className starting with `card`, `item`, `tile(s)`, `empty`, `lrow`, `tag`, `chip(s)`, or
  `h4.sec`, outside the primitive files.
- **G4** every routed view renders `<Page>` (exempt: Workout, FocusView, Login, MobileOnboarding;
  the baselined views may only leave the list).
- **G5** each primitive's markup equals the legacy markup it replaces.
- **G6** nothing outside `sheets.jsx` and `src/sheets/` imports `src/sheets/*`.
- **G7** a new stylesheet holds no hex outside `:root` and no `max-width`.

Only the orchestrator regenerates the baseline (`node scripts/ui-guards-baseline.mjs`), to
tighten it after a migration merges. Never regenerate it to turn a guard green.
