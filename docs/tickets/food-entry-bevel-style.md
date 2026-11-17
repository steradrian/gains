# Food entry: complete nutrients, Bevel-style, on a full-screen sheet

Status: idea, not scheduled. Written 2026-10-26 from first-user feedback, for whoever picks it up.

## The feedback

- Adding a food should feel complete about nutrients. The reference is Bevel's **Add food** screen
  (screenshots were shared in the session; the layout is described below).
- Adding a food, searching for one and creating a recipe are complex enough to deserve a
  **full-screen sheet** rather than the current drawer. The owner flagged this as worth exploring,
  not as a decision.

## What Bevel's Add food screen does

One scrolling form, header with a delete (trash) button on the left, the title, and a barcode-scan
button on the right; a single **Save** button fixed at the foot.

Rows are a label on the left and a compact field on the right with the unit inside it ("— g",
"— kCal", "— mg"); an empty field shows a dash. Groups are separated by a thin rule:

1. **Energy** (kcal), then **Fat**, **Carbs**, **Protein**, each macro label in its own colour with
   its share of energy next to it ("Fat 0%"), updating as you type.
2. Fat detail: Saturated, Trans, Polyunsaturated, Monounsaturated; then Cholesterol, Sodium.
3. Carb detail: Dietary Fiber, Total Sugars, Added Sugars.
4. Micronutrients: Vitamin D, Calcium, Iron, Potassium.
5. Caffeine.
6. A dashed **Add additional** row with a + to add any other nutrient.

Everything is visible at once; nothing hides behind a "More" disclosure.

## Where Gains is today

- The data is already there. `frontend/src/lib/nutrition/foods.js` `NUTRIENTS` holds energy, the
  macros, the fat and sugar breakdowns, fibre, salt/sodium, cholesterol, potassium, calcium, iron,
  magnesium, zinc, phosphorus, caffeine, alcohol, vitamins A/C/D/E/K and the B vitamins, per
  serving. Entries flagged `main` show first; the rest sit under "More nutrients".
- The editor is `frontend/src/views/my-foods/FoodEditorForm.jsx`; Open Food Facts mapping is
  `lib/nutrition/off.js`; storage is the nutrition service (steradrian/gains-nutrition).
- So the gap is presentation, not the data model: grouping with rules, the macro colours and
  energy shares, units inside the fields, the custom "add additional" nutrient (not supported by the
  model today), scan from inside the editor, and the full-screen container.

## Open questions

- Which nutrients show by default versus behind "Add additional"? Bevel shows ~20; showing all ~30
  of ours at once may be too long. Suggested: Bevel's set by default, the rest through "Add".
- A custom nutrient needs a model change (a free-form name + unit per food) in gains-nutrition and
  in sync; check the server schema before promising it.
- Full-screen sheet: one container for search → food → edit → recipe, with sub-panels sliding
  inside it (the app's "no drawer on top of a drawer" rule), or separate full-screen pages? Needs a
  board before building.
- Macro colours must come from the design tokens (the rings already colour protein/carbs/fat; reuse
  those), not new hex values.
- Energy share should follow the existing kcal-per-gram rule the app uses elsewhere (4/4/9, alcohol 7).
