export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Cardio'

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  is_custom: boolean
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  date: string
  notes: string | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  order_index: number
  exercise?: Exercise
  sets?: Set[]
}

export interface Set {
  id: string
  workout_exercise_id: string
  set_number: number
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  notes: string | null
}

export interface WorkoutWithExercises extends Workout {
  workout_exercises: (WorkoutExercise & {
    exercise: Exercise
    sets: Set[]
  })[]
}

export interface ExerciseHistorySession {
  workout_id: string
  date: string
  sets: Set[]
}

export interface Template {
  id: string
  name: string
  created_at: string
}

export interface TemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  order_index: number
  default_sets: number
  exercise: Exercise
}

export interface TemplateWithExercises extends Template {
  template_exercises: TemplateExercise[]
}
