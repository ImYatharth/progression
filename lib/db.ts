import { createClient } from './supabase'
import type {
  Exercise, Workout, WorkoutWithExercises, ExerciseHistorySession, MuscleGroup,
  TemplateWithExercises,
} from '@/types'

// ── Exercises ──────────────────────────────────────────────────────────────

export async function getExercises(): Promise<Exercise[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('muscle_group', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createCustomExercise(name: string, muscle_group: MuscleGroup): Promise<Exercise> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name, muscle_group, is_custom: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateExercise(id: string, name: string, muscle_group: MuscleGroup): Promise<Exercise> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .update({ name, muscle_group })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

// ── Workouts ───────────────────────────────────────────────────────────────

export async function getWorkoutDatesForMonth(year: number, month: number): Promise<string[]> {
  const supabase = createClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`
  const { data, error } = await supabase
    .from('workouts')
    .select('date')
    .gte('date', startDate)
    .lte('date', endDate)
  if (error) throw error
  return data.map((w) => w.date)
}

export async function getMonthStats(year: number, month: number) {
  const supabase = createClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select('id')
    .gte('date', startDate)
    .lte('date', endDate)
  if (wErr) throw wErr

  if (workouts.length === 0) return { totalWorkouts: 0, totalSets: 0 }

  const workoutIds = workouts.map((w) => w.id)
  const { data: weData, error: weErr } = await supabase
    .from('workout_exercises')
    .select('id')
    .in('workout_id', workoutIds)
  if (weErr) throw weErr

  if (weData.length === 0) return { totalWorkouts: workouts.length, totalSets: 0 }

  const weIds = weData.map((we) => we.id)
  const { count, error: sErr } = await supabase
    .from('sets')
    .select('id', { count: 'exact', head: true })
    .in('workout_exercise_id', weIds)
  if (sErr) throw sErr

  return { totalWorkouts: workouts.length, totalSets: count ?? 0 }
}

export async function getWorkoutByDate(date: string): Promise<WorkoutWithExercises | null> {
  const supabase = createClient()
  const { data: workout, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  if (!workout) return null

  const { data: wes, error: weErr } = await supabase
    .from('workout_exercises')
    .select(`
      *,
      exercise:exercises(*),
      sets(*)
    `)
    .eq('workout_id', workout.id)
    .order('order_index', { ascending: true })
  if (weErr) throw weErr

  const sortedWes = (wes || []).map((we) => ({
    ...we,
    sets: (we.sets || []).sort((a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number),
  }))

  return { ...workout, workout_exercises: sortedWes }
}

export async function upsertWorkout(date: string, notes: string | null): Promise<Workout> {
  const supabase = createClient()
  const { data: existing } = await supabase
    .from('workouts')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('workouts')
      .update({ notes })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert({ date, notes })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveWorkout(
  date: string,
  notes: string | null,
  exercises: Array<{
    exerciseId: string
    orderIndex: number
    sets: Array<{
      setNumber: number
      reps: number | null
      weightKg: number | null
      durationSeconds: number | null
    }>
  }>
) {
  const supabase = createClient()

  // Upsert workout
  const workout = await upsertWorkout(date, notes)

  // Delete existing workout_exercises (cascades to sets via foreign key)
  await supabase.from('sets').delete().in(
    'workout_exercise_id',
    (
      await supabase
        .from('workout_exercises')
        .select('id')
        .eq('workout_id', workout.id)
    ).data?.map((r) => r.id) ?? []
  )
  await supabase.from('workout_exercises').delete().eq('workout_id', workout.id)

  if (exercises.length === 0) return workout

  // Insert workout_exercises
  const { data: weInserted, error: weErr } = await supabase
    .from('workout_exercises')
    .insert(
      exercises.map((ex) => ({
        workout_id: workout.id,
        exercise_id: ex.exerciseId,
        order_index: ex.orderIndex,
      }))
    )
    .select()
  if (weErr) throw weErr

  // Insert sets
  const allSets: Array<{
    workout_exercise_id: string
    set_number: number
    reps: number | null
    weight_kg: number | null
    duration_seconds: number | null
  }> = []

  exercises.forEach((ex, i) => {
    const we = weInserted[i]
    ex.sets.forEach((s) => {
      allSets.push({
        workout_exercise_id: we.id,
        set_number: s.setNumber,
        reps: s.reps,
        weight_kg: s.weightKg,
        duration_seconds: s.durationSeconds,
      })
    })
  })

  if (allSets.length > 0) {
    const { error: sErr } = await supabase.from('sets').insert(allSets)
    if (sErr) throw sErr
  }

  return workout
}

export async function deleteWorkout(date: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('workouts').delete().eq('date', date)
  if (error) throw error
}

// ── Exercise History ──────────────────────────────────────────────────────

// A set only counts as real logged data if at least one value was entered.
// Rows the user added but left blank (all-null) are ignored so empty
// sessions don't clutter "last session" / history views.
function hasLoggedData(sets: Array<{ reps: number | null; weight_kg: number | null; duration_seconds: number | null }>): boolean {
  return sets.some((s) => s.reps != null || s.weight_kg != null || s.duration_seconds != null)
}

// Fetch every logged session of an exercise in ONE round-trip, with each
// session's workout date and sets embedded. Replaces the old per-workout
// N+1 loops. Returns sessions with real logged data, newest-first.
async function fetchExerciseSessions(exerciseId: string): Promise<ExerciseHistorySession[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      workout:workouts!inner(id, date),
      sets(*)
    `)
    .eq('exercise_id', exerciseId)
  if (error) throw error
  if (!data) return []

  const sessions: ExerciseHistorySession[] = []
  for (const row of data) {
    const workout = (row.workout as unknown) as { id: string; date: string } | null
    const sets = (row.sets || []) as ExerciseHistorySession['sets']
    if (!workout || !hasLoggedData(sets)) continue
    sessions.push({
      workout_id: workout.id,
      date: workout.date,
      sets: [...sets].sort((a, b) => a.set_number - b.set_number),
    })
  }
  return sessions.sort((a, b) => b.date.localeCompare(a.date))
}

export async function getLastSessionForExercise(
  exerciseId: string,
  beforeDate: string
): Promise<ExerciseHistorySession | null> {
  const sessions = await fetchExerciseSessions(exerciseId)
  return sessions.find((s) => s.date < beforeDate) ?? null
}

// Batched version of getLastSessionForExercise: one query for many
// exercises at once. Used on workout-log load so a session with N
// exercises does 1 round-trip instead of N.
export async function getLastSessionsForExercises(
  exerciseIds: string[],
  beforeDate: string
): Promise<Record<string, ExerciseHistorySession | null>> {
  const result: Record<string, ExerciseHistorySession | null> = {}
  if (exerciseIds.length === 0) return result

  const supabase = createClient()
  const { data, error } = await supabase
    .from('workout_exercises')
    .select(`
      exercise_id,
      workout:workouts!inner(id, date),
      sets(*)
    `)
    .in('exercise_id', exerciseIds)
  if (error) throw error

  const byExercise: Record<string, ExerciseHistorySession[]> = {}
  for (const row of data || []) {
    const workout = (row.workout as unknown) as { id: string; date: string } | null
    const sets = (row.sets || []) as ExerciseHistorySession['sets']
    if (!workout || workout.date >= beforeDate || !hasLoggedData(sets)) continue
    const session: ExerciseHistorySession = {
      workout_id: workout.id,
      date: workout.date,
      sets: [...sets].sort((a, b) => a.set_number - b.set_number),
    }
    ;(byExercise[row.exercise_id] ||= []).push(session)
  }

  for (const id of exerciseIds) {
    const list = byExercise[id]
    if (!list || list.length === 0) { result[id] = null; continue }
    list.sort((a, b) => b.date.localeCompare(a.date))
    result[id] = list[0]
  }
  return result
}

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistorySession[]> {
  // Chart/list want oldest-first
  const sessions = await fetchExerciseSessions(exerciseId)
  return sessions.reverse()
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function getTemplates(): Promise<TemplateWithExercises[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('templates')
    .select(`
      *,
      template_exercises(
        *,
        exercise:exercises(*)
      )
    `)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((t) => ({
    ...t,
    template_exercises: (t.template_exercises || []).sort(
      (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
    ),
  }))
}

export async function createTemplate(
  name: string,
  exercises: Array<{ exerciseId: string; defaultSets: number }>
): Promise<void> {
  const supabase = createClient()
  const { data: template, error } = await supabase
    .from('templates')
    .insert({ name })
    .select()
    .single()
  if (error) throw error

  if (exercises.length > 0) {
    const { error: teErr } = await supabase.from('template_exercises').insert(
      exercises.map((ex, i) => ({
        template_id: template.id,
        exercise_id: ex.exerciseId,
        order_index: i,
        default_sets: ex.defaultSets,
      }))
    )
    if (teErr) throw teErr
  }
}

export async function updateTemplate(
  id: string,
  name: string,
  exercises: Array<{ exerciseId: string; defaultSets: number }>
): Promise<void> {
  const supabase = createClient()

  const { error: nameErr } = await supabase
    .from('templates')
    .update({ name })
    .eq('id', id)
  if (nameErr) throw nameErr

  // Replace the exercise set: delete existing rows, insert the new list.
  const { error: delErr } = await supabase
    .from('template_exercises')
    .delete()
    .eq('template_id', id)
  if (delErr) throw delErr

  if (exercises.length > 0) {
    const { error: insErr } = await supabase.from('template_exercises').insert(
      exercises.map((ex, i) => ({
        template_id: id,
        exercise_id: ex.exerciseId,
        order_index: i,
        default_sets: ex.defaultSets,
      }))
    )
    if (insErr) throw insErr
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw error
}
