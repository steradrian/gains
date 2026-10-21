// Workout guard M1, the cases not yet ported. Each todo names its old file:line; the hand-back
// (docs/handoffs/gains-workout-guard-m1-handback.md) maps every one to its new home. They are
// todos, not skipped tests, so the count stays visible until guard-M2 may delete the old files.
// Ported already: views/workout/use-workout.test.jsx (completion flow, displaced hold, heartbeat).
import { describe, it } from 'vitest'

const todos = (title, list) => describe(title, () => { for (const name of list) it.todo(name) })

todos('add exercise and no-progression blocks', [
  'Workout.test.jsx:543 inserts after the current unit and leaves the inserted exercise selected (freestyle, planned) [drawers.js addExerciseSheet, mock exercisePicker and exConfigSheet]',
  'Workout.test.jsx:571 inserts after the complete current superset without splitting the group; the confirm says "Add to this workout" [drawers.js addExerciseSheet]',
  'Workout.test.jsx:602 an exercise added to a rehab block is kept out too, at the numbers typed',
  'Workout.test.jsx:611 still progresses when the block is a regular routine\'s',
  'Workout.test.jsx:622 an exercise added to a past workout is built from the history before its day',
  'Workout.test.jsx:633 does not pass on an exercise kept out by hand for today',
])

todos('weight controls on the new steppers (aria-label "More kg" / "Less kg")', [
  'Workout.test.jsx:652 configured weight step for manual increases and decreases, with the default fallback',
  'Workout.test.jsx:668 added weight stays editable at zero for a bodyweight exercise ("More Added (kg)")',
  'Workout.test.jsx:684 matches automatic progression rounding for a fractional configured step',
  'Workout.test.jsx:698 drop-set weight step [Set edit drawer: exercise-drawers.test.jsx, drawers-M3 does not own it]',
  'Workout.test.jsx:709 timed seconds and optional timed weight keep their steps ("More Seconds", "More kg")',
  'Workout.stepper.test.jsx:153 increments a superset member weight by one step per tap',
  'Workout.stepper.test.jsx:167 advances reps by exactly one per tap across repeated taps',
  'Workout.stepper.test.jsx:183 steps the partner exercise correctly after the first member was changed',
  'Workout.stepper.test.jsx:197 decrements a superset member weight by one step per tap',
])

todos('discard timer lifecycle (finish-drawers discardSheet and lib/workout-discard.js discardWithUndo)', [
  'Workout.test.jsx:833 preserves active timers while discard is awaiting confirmation',
  'Workout.test.jsx:850 clears rest and work timers only after discard is confirmed',
])

todos('progression guidance and settings (the plan line moved into How to / Exercise settings, drawers-M2)', [
  'Workout.test.jsx:998 labels the visible outcome with the policy that calculated it [gap check: does the new screen show a progression line at all]',
  'Workout.test.jsx:1012 progression line is a keyboard-accessible button that opens settings for the pressed grouped entry',
  'Workout.test.jsx:1040 does not save into a different duplicate occurrence after the entry list shifts [exercise-drawers entry-id guard]',
  'Workout.test.jsx:1060 does not save through a sheet left open from a replaced workout',
  'Workout.test.jsx:1081 leaves the active entry unchanged when progression settings are cancelled',
  'Workout.test.jsx:1096 saves the active policy, preserves completed rows, refreshes guidance immediately',
  'Workout.test.jsx:1156 settings rebuild: opens the plan\'s reps and stamps the prescription into the target',
  'Workout.test.jsx:1165 settings rebuild: carries last session\'s reps when the profile starts from the last session',
  'Workout.test.jsx:1215 saving unchanged keeps a double-progression raise in place',
  'Workout.test.jsx:1230 saving unchanged keeps a bodyweight climb',
  'Workout.test.jsx:1242 saving unchanged keeps a set the rep ceiling added, and the plan line reads the plan',
  'Workout.test.jsx:1253 keeps the plan\'s weight when only the reps are edited',
])

todos('effort cell (Set edit EffortChips and the effort chips under the hero)', [
  'Workout.test.jsx:1291 shows the effort column only when the profile logs a scale',
  'Workout.test.jsx:1299 labels an unrated cell with the scale name',
  'Workout.test.jsx:1308 an RPE profile reads "RPE"',
  'Workout.test.jsx:1313 shows a logged rating as its number, tinted by its band',
  'Workout.test.jsx:1328 displays a logged value on the profile scale (RIR 2 reads as RPE 8)',
  'Workout.test.jsx:1343 opens the picker for the set on tap with scale, value and a writer',
  'Workout.test.jsx:1368 steps a logged rating up 0.5 on the scale',
  'Workout.test.jsx:1376 steps a logged rating down 0.5',
  'Workout.test.jsx:1382 clears the rating when stepped down off the floor',
])

todos('superset after a removal, whole-unit moves and swap (actions, map is drawers-M3)', [
  'Workout.test.jsx:1396 superset still advances and rests for sets completed after a removal',
  'Workout.test.jsx:1488 moves the selected standalone exercise one unit [workout-actions.moveEntryWithinPart; the map is drawers-M3]',
  'Workout.test.jsx:1513 moves the selected contiguous group as one unit without changing its metadata',
  'Workout.test.jsx:1534 disables both moves while a work timer can still write by index [use-workout.moveUnitAt]',
  'Workout.test.jsx:1545 opens the swap flow for the selected duplicate occurrence [exercise-drawers Swap step]',
])

todos('focus view cases (the new screen is one focus screen; the focus progression is its own)', [
  'Workout.test.jsx:1558 shows only the first incomplete set with its prescription and tactile controls',
  'Workout.test.jsx:1573 moves with chevrons and dots without completing a set',
  'Workout.test.jsx:1599 pairs adjacent exercises and can unpair them [map, drawers-M3]',
  'Workout.test.jsx:1615 uses the shared effort picker for the selected RPE scale',
  'Workout.test.jsx:1631 hides effort when Settings selects none',
  'Workout.test.jsx:1643 locks completed set inputs and mutes their values',
  'Workout.test.jsx:1656 renders and updates independent unilateral sides',
  'Workout.test.jsx:1677 completes both unilateral sides before advancing',
  'Workout.test.jsx:1697 advances when the second individual side is completed',
  'Workout.test.jsx:1716 renders and edits unilateral extras added through the set menu',
  'Workout.test.jsx:1749 shows the timer action instead of reps for timed sets',
  'Workout.test.jsx:1762 advances when a timed set finishes through the shared timer',
  'Workout.test.jsx:1778 does not advance when rechecking a completed final set',
  'Workout.test.jsx:1792 uses the duration and speed fields for cardio',
  'Workout.test.jsx:1806 keeps drop and burst rows editable and opens every set action [Set edit, exercise-drawers.test.jsx:124]',
  'Workout.test.jsx:1838 completes, starts rest, advances sets, then advances to the next unfinished exercise',
  'Workout.test.jsx:1854 shows one superset member and follows round-major completion order',
  'Workout.test.jsx:1883 uses the superset switch for inspection without completing work',
  'Workout.test.jsx:1896 and :1915 :1930 :1946 :1960 :1975 inspected-set pointer cases: dropped by design if the screen keeps no per-set pointer (confirm)',
])

todos('hardware keys (Workout.keys.test.jsx), run on the hook\'s key listener', [
  'Workout.keys.test.jsx:63 Space ticks the next open set of the current exercise and starts its rest',
  'Workout.keys.test.jsx:73 Space and Enter tick through the same handler',
  'Workout.keys.test.jsx:81 once the exercise on screen is finished a press brings up the next one, the next press ticks it',
  'Workout.keys.test.jsx:90 the arrows switch exercise',
  'Workout.keys.test.jsx:103 list scroll on arrow: dropped by design (layouts, owner question 1)',
  'Workout.keys.test.jsx:122 keys typed into a set\'s field stay in the field',
  'Workout.keys.test.jsx:132 does nothing while a sheet is open on top',
  'Workout.keys.test.jsx:141 a timed set is started rather than ticked, and the next press is its Done',
  'Workout.keys.test.jsx:154 a second press right after a hold starts does not log it at a second',
  'Workout.keys.test.jsx:171 stops listening when the screen goes away',
])

todos('timed hold and sides (Workout.hold.test.jsx)', [
  'Workout.hold.test.jsx:63 ran out on its own: chime and buzz pattern, no tick beep or short buzz after',
  'Workout.hold.test.jsx:75 finished early with Done: ticks the way a tap does, beep and buzz',
  'Workout.hold.test.jsx:100 left held: a 10 s Switch sides countdown that ends with the chime [WorkoutScreen.test.jsx covers the switch itself]',
  'Workout.hold.test.jsx:113 right held too: the set\'s full rest, not another switch',
  'Workout.hold.test.jsx:123 Left and Right pills one width (#322): dropped by design if TimedHold replaced the pills',
])

todos('superset scroll (Workout.superset-scroll.test.jsx): dropped by design, one focus screen has no list to scroll (owner question 1)', [
  'Workout.superset-scroll.test.jsx:139-303 thirteen scroll cases, confirm the drop with the orchestrator',
])

todos('rest in the footer (RestTimer.dock / RestTimer.ready, now WorkoutFooter)', [
  'RestTimer.dock.test.jsx:47 one row: the clock with its label, then -15, +15, pause and Skip',
  'RestTimer.dock.test.jsx:61 keeps every button in its slot when the rest turns Ready',
  'RestTimer.dock.test.jsx:81 Skip as an icon, Dismiss as x once Ready: dropped by design if the footer has no narrow form',
  'RestTimer.dock.test.jsx:102 says Paused under the clock while the rest is held',
  'RestTimer.dock.test.jsx:109 opens the wheel at the time left, Done sets the rest [exercise-drawers.test.jsx:357 covers the wheel]',
  'RestTimer.dock.test.jsx:123 ends the rest at 0:00, and starts a fresh one when the old one had run out',
  'RestTimer.dock.test.jsx:136 Done on an untouched wheel leaves the rest alone',
  'RestTimer.dock.test.jsx:168 +15 s stops at the wheel maximum of 15:00',
  'RestTimer.dock.test.jsx:180 keeps a paused rest paused at the new time',
  'RestTimer.ready.test.jsx:37 keeps Ready and its Dismiss action across a remount',
  'RestTimer.ready.test.jsx:55 shows a plus clock and an empty bar during opted-in overtime',
  'RestTimer.ready.test.jsx:70 pauses the countdown, shows it held, resumes from the same second',
  'RestTimer.ready.test.jsx:90 offers no pause once the rest is Ready, and none on the timed hold',
  'RestTimer.ready.test.jsx:104 names the pause, counts it down, and goes without a Ready or a toast',
])

todos('FocusView.test.jsx (the focus progression is the new screen\'s)', [
  'FocusView.test.jsx:58 omits a plan that repeats the prescription and keeps plate guidance in the badge row',
  'FocusView.test.jsx:75 shows only a changed plan as a badge',
  'FocusView.test.jsx:92 offers the per-exercise progression switch and marks the current exercise',
  'FocusView.test.jsx:107 uses the exercise rest-pause duration for a new burst',
  'FocusView.test.jsx:143 reads, steps and takes typing in mph for a profile in pounds, and stores km/h',
  'FocusView.test.jsx:153 follows a chosen unit over the weight unit, and leaves km/h as it was',
])
