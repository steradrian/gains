# Active workout screen redesign (cards layout) — task brief

> Status: **not started.** This is a design brief for a future change, not a description of current behavior. See [Workout views](LIST_VIEW.md) for how the screen works today.

## Summary

The active workout screen (cards layout, `frontend/src/views/Workout.jsx`, `ActiveWorkout`) feels like a web page rather than a native-style app. There is no clear visual hierarchy, navigation between exercises is awkward, and secondary actions are scattered. This brief collects the problems and a proposed redesign. No implementation is attached.

## Problems

**Hierarchy and spacing**
- Title, muscle/equipment tags, plan line, progression hint and set card all carry similar weight; gaps between them are uneven.
- Green is used for too many things: progression hint, Prev/Next links, CTAs, done state.
- The progression hint takes a full-width line even when it says nothing useful ("Nothing logged yet, so this session sets the baseline.").

**Navigation**
- The numbered exercise chips (`WorkoutChips.jsx`) read like web pagination.
- Prev and Next are text links with chevrons (`Workout.jsx` ~L2043), not buttons.

**Scattered secondary controls**
- "Add exercise", "Add session note" and "Finish workout early" float mid-page (`Workout.jsx` ~L2048-2081). Add exercise and the session note already exist in the header ⋯ menu (`openViewMenu`), so these are duplicates. "Finish workout early" duplicates the header Finish.
- The header Finish is a solid green primary button from the first set.

**Progress and timers**
- Two progress measures compete: "3/34 sets" (header) and "2/11 exercises" (bottom).
- Elapsed time is small even though it matters mid-workout.

**Possible bug to check**
- A screenshot shows "Plan: 3 × 10" with only 2 set rows. Unconfirmed whether the routine had 2 sets, a set was deleted, or this is a bug.

## Proposal

1. **Header:** chevron, workout name, elapsed time and set count, ⋯ menu, one progress bar. No Finish pill until it is relevant.
2. **Position row:** "Exercise 3 of 11" with a thin segmented strip. Tapping opens an "all exercises" sheet to jump to any exercise, reusing `exerciseChips` status. Swipe between exercises stays (`SwipeCards`).
3. **Exercise header:** larger title, muscle and equipment as one quiet subtitle line, exercise actions (swap, move, remove) in that exercise's ⋯.
4. **Plan line:** merge "Plan: 3 × 10" and the progression hint into one muted line; hide the hint when it only says "nothing logged yet".
5. **Set rows:** larger check target. The "Added (kg)" label stays as is.
6. **Bottom dock:**
   - Prev and Next become icon buttons in a fixed footer dock.
   - Exercises 1 to N-1: dock is Prev | Next.
   - Last exercise, or all sets done: Next becomes the primary Finish action.
   - Finishing early stays in the header ⋯ and the existing Finish sheet. A Finish button between Prev and Next risks misfires, so it is not placed there by default.
   - **The rest timer is added on top of the Prev/Next dock row** (stacked above it) rather than replacing it, so both are visible during a rest. Reuse the existing `RestTimer` controls (-15, +15, pause, Skip/Dismiss).
7. **Remove** the duplicate bottom buttons ("Add exercise", "Add session note", "Finish workout early").
8. **Secondary actions are sheets on the same route**, not separate pages, so workout state, timer and back stack are kept. Add exercise is a full-height sheet with search; the note is a small sheet.

## Already true, no change needed
- The tab bar is already hidden on the workout screen.
- The rest timer is already docked at the bottom (`RestTimer.jsx`); the change is stacking it above the new nav row.
- The pill chips are already optional via `wc.exerciseChips`.

## Open questions
- Scope: cards layout only, or also list, compact and focus? Suggested: cards only to start.
- Wording: the screen is a workout/session while "routine" is the plan template. Consider "Start workout" for this flow's UI copy.
- Confirm the "Plan 3 × 10 vs 2 set rows" case.

## Implementation notes
- Many `Workout.*.test.jsx` tests query "Prev", "Next", "Finish workout early" and the chips by text or label, so they need updating.
- Every new or changed string needs a locale catalogue entry (checked in CI).
- No new dependencies.
