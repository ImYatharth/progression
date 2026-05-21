import { createClient } from './supabase'
import type { Exercise, Workout, WorkoutWithExercises, ExerciseHistorySession, MuscleGroup } from '@/types'

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

export async function getLastSessionForExercise(
  exerciseId: string,
  beforeDate: string
): Promise<ExerciseHistorySession | null> {
  const supabase = createClient()

  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select('id, date')
    .lt('date', beforeDate)
    .order('date', { ascending: false })
  if (wErr) throw wErr
  if (!workouts || workouts.length === 0) return null

  for (const workout of workouts) {
    const { data: we } = await supabase
      .from('workout_exercises')
      .select('id')
      .eq('workout_id', workout.id)
      .eq('exercise_id', exerciseId)
      .maybeSingle()

    if (we) {
      const { data: sets } = await supabase
        .from('sets')
        .select('*')
        .eq('workout_exercise_id', we.id)
        .order('set_number', { ascending: true })

      return {
        workout_id: workout.id,
        date: workout.date,
        sets: sets || [],
      }
    }
  }
  return null
}

export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistorySession[]> {
  const supabase = createClient()

  const { data: wes, error } = await supabase
    .from('workout_exercises')
    .select(`
      id,
      workout:workouts(id, date)
    `)
    .eq('exercise_id', exerciseId)
  if (error) throw error
  if (!wes || wes.length === 0) return []

  const results: ExerciseHistorySession[] = []

  for (const we of wes) {
    const workout = (we.workout as unknown) as { id: string; date: string } | null
    if (!workout) continue

    const { data: sets } = await supabase
      .from('sets')
      .select('*')
      .eq('workout_exercise_id', we.id)
      .order('set_number', { ascending: true })

    results.push({
      workout_id: workout.id,
      date: workout.date,
      sets: sets || [],
    })
  }

  return results.sort((a, b) => a.date.localeCompare(b.date))
}
