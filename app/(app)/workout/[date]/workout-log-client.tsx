"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, ChevronLeft, Clock, Save, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase'
import { getExercises, createCustomExercise, getLastSessionForExercise, saveWorkout } from '@/lib/db'
import type { Exercise, MuscleGroup, ExerciseHistorySession } from '@/types'

const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']

interface SetRow {
  id: string
  setNumber: number
  reps: string
  weightKg: string
  durationSeconds: string
}

interface WorkoutExerciseEntry {
  id: string
  exercise: Exercise
  sets: SetRow[]
  lastSession: ExerciseHistorySession | null
}

interface WorkoutLogClientProps {
  date: string
}

export function WorkoutLogClient({ date }: WorkoutLogClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseEntry[]>([])
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // Custom exercise modal
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>('Chest')

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split('-').map(Number)
      return format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy')
    } catch {
      return date
    }
  })()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const exList = await getExercises()
      setExercises(exList)

      const supabase = createClient()
      const { data: workout } = await supabase
        .from('workouts')
        .select('id, notes')
        .eq('date', date)
        .maybeSingle()

      if (workout) {
        setNotes(workout.notes ?? '')
        const { data: wes } = await supabase
          .from('workout_exercises')
          .select(`*, exercise:exercises(*), sets(*)`)
          .eq('workout_id', workout.id)
          .order('order_index', { ascending: true })

        if (wes) {
          const entries: WorkoutExerciseEntry[] = await Promise.all(
            wes.map(async (we) => {
              const sortedSets = (we.sets || [])
                .sort((a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number)
                .map((s: { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null }) => ({
                  id: crypto.randomUUID(),
                  setNumber: s.set_number,
                  reps: s.reps?.toString() ?? '',
                  weightKg: s.weight_kg?.toString() ?? '',
                  durationSeconds: s.duration_seconds?.toString() ?? '',
                }))

              const lastSession = await getLastSessionForExercise(we.exercise.id, date)

              return {
                id: crypto.randomUUID(),
                exercise: we.exercise,
                sets: sortedSets,
                lastSession,
              }
            })
          )
          setWorkoutExercises(entries)
        }
      }
      setLoading(false)
    }
    load()
  }, [date])

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscle_group.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedExercises = MUSCLE_GROUPS.reduce<Record<string, Exercise[]>>((acc, mg) => {
    const group = filteredExercises.filter((ex) => ex.muscle_group === mg)
    if (group.length > 0) acc[mg] = group
    return acc
  }, {})

  const addedExerciseIds = new Set(workoutExercises.map((we) => we.exercise.id))

  async function handleAddExercise(exercise: Exercise) {
    if (addedExerciseIds.has(exercise.id)) return
    const lastSession = await getLastSessionForExercise(exercise.id, date)
    setWorkoutExercises((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        exercise,
        sets: [{ id: crypto.randomUUID(), setNumber: 1, reps: '', weightKg: '', durationSeconds: '' }],
        lastSession,
      },
    ])
    setShowSearch(false)
    setSearchQuery('')
  }

  function removeExercise(entryId: string) {
    setWorkoutExercises((prev) => prev.filter((we) => we.id !== entryId))
  }

  function addSet(entryId: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.id === entryId
          ? {
              ...we,
              sets: [
                ...we.sets,
                {
                  id: crypto.randomUUID(),
                  setNumber: we.sets.length + 1,
                  reps: '',
                  weightKg: '',
                  durationSeconds: '',
                },
              ],
            }
          : we
      )
    )
  }

  function removeSet(entryId: string, setId: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.id === entryId
          ? {
              ...we,
              sets: we.sets
                .filter((s) => s.id !== setId)
                .map((s, i) => ({ ...s, setNumber: i + 1 })),
            }
          : we
      )
    )
  }

  function updateSet(entryId: string, setId: string, field: keyof SetRow, value: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.id === entryId
          ? {
              ...we,
              sets: we.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
          : we
      )
    )
  }

  async function handleCreateCustomExercise() {
    if (!customName.trim()) return
    try {
      const ex = await createCustomExercise(customName.trim(), customMuscleGroup)
      setExercises((prev) => [...prev, ex])
      setShowCustomModal(false)
      setCustomName('')
      await handleAddExercise(ex)
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to create exercise', variant: 'destructive' })
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveWorkout(
        date,
        notes || null,
        workoutExercises.map((we, i) => ({
          exerciseId: we.exercise.id,
          orderIndex: i,
          sets: we.sets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps ? parseInt(s.reps) : null,
            weightKg: s.weightKg ? parseFloat(s.weightKg) : null,
            durationSeconds: s.durationSeconds ? parseInt(s.durationSeconds) : null,
          })),
        }))
      )
      toast({ title: 'Workout saved!' })
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold leading-tight">{formattedDate}</h1>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Session notes</Label>
        <Textarea
          placeholder="How did it go? Any PRs?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none h-16 text-sm"
        />
      </div>

      {/* Exercise list */}
      {workoutExercises.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          date={date}
          onRemove={() => removeExercise(entry.id)}
          onAddSet={() => addSet(entry.id)}
          onRemoveSet={(setId) => removeSet(entry.id, setId)}
          onUpdateSet={(setId, field, value) => updateSet(entry.id, setId, field, value)}
        />
      ))}

      {/* Add exercise button */}
      {showSearch ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-3 border-b border-border">
            <Input
              autoFocus
              placeholder="Search exercises…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {Object.entries(groupedExercises).map(([group, exs]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/30 sticky top-0">
                  {group}
                </div>
                {exs.map((ex) => (
                  <button
                    key={ex.id}
                    disabled={addedExerciseIds.has(ex.id)}
                    onClick={() => handleAddExercise(ex)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/40 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>{ex.name}</span>
                    {addedExerciseIds.has(ex.id) && <span className="text-xs text-muted-foreground">Added</span>}
                  </button>
                ))}
              </div>
            ))}
            <button
              onClick={() => { setShowSearch(false); setShowCustomModal(true) }}
              className="w-full text-left px-3 py-3 text-sm text-primary hover:bg-secondary/40 flex items-center gap-2 border-t border-border"
            >
              <Plus className="h-4 w-4" />
              Add custom exercise
            </button>
          </div>
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setShowSearch(false); setSearchQuery('') }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setShowSearch(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add exercise
        </Button>
      )}

      {/* Floating save */}
      <div className="fixed bottom-4 left-0 right-0 px-4 max-w-4xl mx-auto">
        <Button className="w-full h-12 text-base font-semibold shadow-2xl" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save Workout'}
        </Button>
      </div>

      {/* Custom exercise modal */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New custom exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Exercise name</Label>
              <Input
                autoFocus
                placeholder="e.g. Cable Fly"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Muscle group</Label>
              <Select value={customMuscleGroup} onValueChange={(v) => setCustomMuscleGroup(v as MuscleGroup)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUPS.map((mg) => (
                    <SelectItem key={mg} value={mg}>{mg}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomModal(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomExercise} disabled={!customName.trim()}>Add exercise</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── ExerciseCard ─────────────────────────────────────────────────────────

interface ExerciseCardProps {
  entry: WorkoutExerciseEntry
  date: string
  onRemove: () => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
  onUpdateSet: (setId: string, field: keyof SetRow, value: string) => void
}

const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest: 'bg-red-900/40 text-red-300 border-red-800',
  Back: 'bg-blue-900/40 text-blue-300 border-blue-800',
  Legs: 'bg-green-900/40 text-green-300 border-green-800',
  Shoulders: 'bg-purple-900/40 text-purple-300 border-purple-800',
  Arms: 'bg-orange-900/40 text-orange-300 border-orange-800',
  Core: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  Cardio: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',
}

function ExerciseCard({ entry, date, onRemove, onAddSet, onRemoveSet, onUpdateSet }: ExerciseCardProps) {
  const [showHistory, setShowHistory] = useState(false)
  const router = useRouter()

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Exercise header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push(`/exercise/${entry.exercise.id}`)}
            className="font-semibold text-sm truncate hover:text-primary transition-colors"
          >
            {entry.exercise.name}
          </button>
          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${MUSCLE_GROUP_COLORS[entry.exercise.muscle_group as MuscleGroup]}`}>
            {entry.exercise.muscle_group}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {entry.lastSession && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowHistory((v) => !v)}
              title="Last session"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Last session panel */}
      {showHistory && entry.lastSession && (
        <div className="px-4 py-3 bg-secondary/20 border-b border-border text-xs">
          <p className="text-muted-foreground font-medium mb-2">
            Last: {(() => {
              const [y, m, d] = entry.lastSession.date.split('-').map(Number)
              return format(new Date(y, m - 1, d), 'd MMM yyyy')
            })()} · {entry.lastSession.sets.length} sets
          </p>
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium w-8">Set</th>
                <th className="text-left font-medium">Reps</th>
                <th className="text-left font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {entry.lastSession.sets.map((s) => (
                <tr key={s.id}>
                  <td className="py-0.5 text-muted-foreground">{s.set_number}</td>
                  <td className="py-0.5">{s.reps ?? '—'}</td>
                  <td className="py-0.5">{s.weight_kg != null ? `${s.weight_kg} kg` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sets */}
      <div className="px-4 py-2 space-y-2">
        {/* Column headers */}
        <div className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 text-xs text-muted-foreground pt-1">
          <span>Set</span>
          <span>Reps</span>
          <span>Weight (kg)</span>
          <span />
        </div>

        {entry.sets.map((set) => (
          <div key={set.id} className="grid grid-cols-[32px_1fr_1fr_32px] gap-2 items-center">
            <span className="text-sm text-muted-foreground font-mono text-center">{set.setNumber}</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={set.reps}
              onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
              className="h-11 text-center text-base"
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={set.weightKg}
              onChange={(e) => onUpdateSet(set.id, 'weightKg', e.target.value)}
              className="h-11 text-center text-base"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveSet(set.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground" onClick={onAddSet}>
          <Plus className="h-3 w-3 mr-1" />
          Add set
        </Button>
      </div>
    </div>
  )
}
