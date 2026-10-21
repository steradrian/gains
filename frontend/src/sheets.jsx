// The sheets, split by domain under src/sheets/. This file is the facade: every consumer (and every
// vi.mock('../sheets.jsx')) goes through it, so the names below are the public surface. Named
// re-exports only; nothing outside this file and src/sheets/ imports src/sheets/* (guard G6).
export { addDeviceDataMessage, addDeviceSetupMessage, askAddDeviceData, menuSheet, confirmSheet } from './sheets/confirm-menu.jsx'
export { starterPlanSheet } from './sheets/starter.jsx'
export { bwSheet, weighInsSheet, bwDeltaColor, goalSheet } from './sheets/body-weight.jsx'
export { importFromApp, importFromHevy } from './sheets/import.jsx'
export { barWeightSheet, plateInventorySheet, dumbbellInventorySheet, equipmentProfileSheet } from './sheets/equipment.jsx'
export { detailTags, exerciseDetailSheet, exerciseHistorySheet, addToRoutineSheet, customExSheet, deleteCustomEx } from './sheets/exercise.jsx'
export { exercisePicker, swapActiveWorkoutExercise } from './sheets/exercise-picker.jsx'
export { exConfigSheet, glyphPicker, effortPickerSheet } from './sheets/exercise-config.jsx'
export { planToolsSheet, planShareSheet, planHasRoutines, exportPlanFile, printWholePlan, importPlanFile, PLAN_FILE_ACCEPT, PLAN_IMPORT_PATH, dayOverrideSheet, dayNoteSheet, usePlanDayParam } from './sheets/plan.jsx'
export { workoutDateSheet, workoutDurationSheet, workoutDetailSheet, calendarSheet, WorkoutRow } from './sheets/workout-detail.jsx'
// Train history (slice 5): T8.1's Edit menu and Delete with Undo, opening a day, T8.3 Share.
export { editWorkoutSheet, deleteWorkoutWithUndo, openDay, dayWorkoutsSheet } from './sheets/workout-detail.jsx'
export { shareWorkoutSheet } from './sheets/workout-share.jsx'
export {
  startOrResume, startFlow, beginWorkout, repeatWorkout, logPastWorkoutSheet, addRoutineToSessionSheet,
  exerciseNoteSheet, setNoteSheet, sessionNoteSheet, renameWorkoutSheet, supersetSheet, workoutCompleteSheet,
  saveWorkoutEdits, exitWorkoutEdit, setsLine, finishWorkout, finishWorkoutSheet,
  // Workout finish M1
  openReady, startFromReady, finishAndSave,
  // Workout finish M2
  readyOrStart, finishToSummary,
} from './sheets/workout-flow.jsx'
export { startChooserSheet, dayOptionsSheet } from './sheets/train-day.jsx'
