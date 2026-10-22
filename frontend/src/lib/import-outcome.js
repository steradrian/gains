// What an import did, for the Import done screen (board St1Imported). Pure: the importers
// (lib/import-csv.js mergeImport, lib/import-hevy.js) do the merging and are untouched; this reads
// the parsed file, the days the history already had before the merge, and what the merge reported.
// Existing days win in mergeImport, so those days (and every set on them) are the ones left alone.

/** The part of a parsed workouts file the merge takes: its sets, exercises, and the days it skips. */
export function workoutStats(parsed, haveDays) {
  const fresh = parsed.workouts.filter(w => !haveDays.has(w.d))
  const ids = new Set()
  let sets = 0
  fresh.forEach(w => w.entries.forEach(e => { ids.add(e.id); sets += e.sets.length }))
  const own = new Set((parsed.customEx || []).map(c => c.id))
  return {
    sets,
    // Exercises the library or an earlier import already knew; the file's new ones are counted as
    // `newNames`, read from what the merge added to the state.
    matched: [...ids].filter(id => !own.has(id)).length,
    leftAlone: new Set(parsed.workouts.filter(w => haveDays.has(w.d)).map(w => w.d)).size,
  }
}

/**
 * A workouts or body-weight file, imported. `haveDays` are the days (workouts, or weigh-ins for a
 * body-weight file) the history had before the merge, `res` is mergeImport's answer, `newNames`
 * the exercises it added as the person's own.
 */
export function importOutcome({ parsed, haveDays, res, newNames = [] }) {
  const base = { source: parsed.source || null, from: parsed.from || null, to: parsed.to || null, imported: res.added }
  if (parsed.kind === 'bodyweight') {
    return { ...base, kind: 'bodyweight', leftAlone: new Set(parsed.bodyweight.filter(b => haveDays.has(b.d)).map(b => b.d)).size }
  }
  const { sets, matched, leftAlone } = workoutStats(parsed, haveDays)
  return { ...base, kind: 'workouts', sets, matched, newNames, leftAlone }
}

/**
 * The Hevy import: `payload` is importHevyData's answer, `added` what each merge reported
 * (`workouts`, `routines`, `weighIns`, 0 for a part left switched off).
 */
export function hevyOutcome({ payload, haveDays, added, newNames = [] }) {
  const w = payload.workouts
  const stats = added.workouts ? workoutStats(w, haveDays) : { sets: 0, matched: 0, leftAlone: 0 }
  return {
    kind: 'hevy', source: 'Hevy', from: w.from || payload.bodyweight.from || null, to: w.to || payload.bodyweight.to || null,
    imported: added.workouts, routines: added.routines, weighIns: added.weighIns,
    sets: stats.sets, matched: stats.matched, newNames, leftAlone: stats.leftAlone,
  }
}
