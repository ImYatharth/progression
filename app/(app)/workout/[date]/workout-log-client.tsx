"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Trash2, ChevronLeft, Clock, Save, Loader2, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase'
import { getExercises, createCustomExercise, getLastSessionForExercise, saveWorkout, deleteWorkout } from '@/lib/db'
import type { Exercise, MuscleGroup, ExerciseHistorySession } from '@/types'

const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio']

const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest: 'bg-red-900/40 text-red-300 border-red-800',
  Back: 'bg-blue-900/40 text-blue-300 border-blue-800',
  Legs: 'bg-green-900/40 text-green-300 border-green-800',
  Shoulders: 'bg-purple-900/40 text-purple-300 border-purple-800',
  Arms: 'bg-orange-900/40 text-orange-300 border-orange-800',
  Core: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  Cardio: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',
}

const NAVBAR_HEIGHT = 56 // px — matches the h-14 navbar

/**
 * Scroll an element so it sits just below the navbar,
 * safely above the on-screen keyboard on mobile.
 */
function scrollCardIntoView(id: string, delay = 120) {
  setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    // visualViewport.height shrinks when the keyboard is open
    const vvHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = el.getBoundingClientRect()
    const gap = 12
    const targetTop = NAVBAR_HEIGHT + gap
    // Only scroll if the card isn't already comfortably visible
    if (rect.top >= targetTop && rect.bottom <= vvHeight - gap) return
    window.scrollTo({
      top: window.scrollY + rect.top - targetTop,
      behavior: 'smooth',
    })
  }, delay)
}

/**
 * Scroll the search dropdown into view above the keyboard.
 */
function scrollSearchIntoView(el: HTMLElement | null, delay = 80) {
  if (!el) return
  setTimeout(() => {
    const vvHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = el.getBoundingClientRect()
    const gap = 12
    const targetTop = NAVBAR_HEIGHT + gap
    if (rect.top >= targetTop && rect.bottom <= vvHeight - gap) return
    window.scrollTo({
      top: window.scrollY + rect.top - targetTop,
      behavior: 'smooth',
    })
  }, delay)
}

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
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExerciseEntry[]>([])
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [loading, setLoading] = useState(true)
  const [addingExerciseId, setAddingExerciseId] = useState<string | null>(null)
  // ID of the most recently added exercise card — used to trigger scroll
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)

  // Delete workout dialog
  const [showDeleteWorkout, setShowDeleteWorkout] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)

  // Remove exercise confirmation
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // Custom exercise modal
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>('Chest')

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split('-').map(Number)
      return format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy')
    } catch { return date }
  })()

  const workoutExists = workoutExercises.length > 0

  // Mark unsaved on changes (skip initial render)
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setSaved(false)
  }, [workoutExercises, notes])

  // Scroll to newly added exercise card
  useEffect(() => {
    if (!lastAddedId) return
    scrollCardIntoView(`exercise-${lastAddedId}`)
    setLastAddedId(null)
  }, [lastAddedId, workoutExercises])

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
              return { id: crypto.randomUUID(), exercise: we.exercise, sets: sortedSets, lastSession }
            })
          )
          setWorkoutExercises(entries)
        }
      }
      setSaved(true)
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

  function openSearch() {
    setShowSearch(true)
    // Scroll search panel into view after it renders
    scrollSearchIntoView(searchContainerRef.current, 100)
  }

  async function handleAddExercise(exercise: Exercise) {
    if (addedExerciseIds.has(exercise.id)) return
    setAddingExerciseId(exercise.id)
    const lastSession = await getLastSessionForExercise(exercise.id, date)
    const newId = crypto.randomUUID()
    setWorkoutExercises((prev) => [
      ...prev,
      { id: newId, exercise, sets: [{ id: crypto.randomUUID(), setNumber: 1, reps: '', weightKg: '', durationSeconds: '' }], lastSession },
    ])
    setAddingExerciseId(null)
    setShowSearch(false)
    setSearchQuery('')
    // Trigger scroll to the new card (effect fires after state update)
    setLastAddedId(newId)
  }

  function confirmRemoveExercise(entryId: string) {
    setConfirmRemoveId(entryId)
  }

  function doRemoveExercise() {
    if (!confirmRemoveId) return
    setWorkoutExercises((prev) => prev.filter((we) => we.id !== confirmRemoveId))
    setConfirmRemoveId(null)
  }

  function addSet(entryId: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) => {
        if (we.id !== entryId) return we
        // Copy reps + weight from the last set so user only edits what changed
        const lastSet = we.sets[we.sets.length - 1]
        return {
          ...we,
          sets: [
            ...we.sets,
            {
              id: crypto.randomUUID(),
              setNumber: we.sets.length + 1,
              reps: lastSet?.reps ?? '',
              weightKg: lastSet?.weightKg ?? '',
              durationSeconds: lastSet?.durationSeconds ?? '',
            },
          ],
        }
      })
    )
  }

  function removeSet(entryId: string, setId: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.id === entryId
          ? { ...we, sets: we.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 })) }
          : we
      )
    )
  }

  function updateSet(entryId: string, setId: string, field: keyof SetRow, value: string) {
    setWorkoutExercises((prev) =>
      prev.map((we) =>
        we.id === entryId
          ? { ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)) }
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
    } catch {
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
      setSaved(true)
      toast({ title: '✓ Workout saved' })
    } catch (err) {
      toast({ title: 'Save failed', description: String(err), variant: 'destructive' })
    }
    setSaving(false)
  }

  async function handleDeleteWorkout() {
    setDeletingWorkout(true)
    try {
      await deleteWorkout(date)
      toast({ title: 'Workout deleted' })
      router.push('/')
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' })
      setDeletingWorkout(false)
      setShowDeleteWorkout(false)
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-secondary animate-pulse" />
          <div className="h-6 w-48 rounded-md bg-secondary animate-pulse" />
        </div>
        <div className="h-16 rounded-xl bg-secondary animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }

  const entryToRemove = workoutExercises.find((we) => we.id === confirmRemoveId)

  return (
    <div className="space-y-4 pb-28 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{formattedDate}</h1>
            {!saved && <p className="text-xs text-amber-400">Unsaved changes</p>}
          </div>
        </div>
        {workoutExists && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => setShowDeleteWorkout(true)}
            title="Delete workout"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Session notes</Label>
        <Textarea
          placeholder="How did it go? Any PRs?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="resize-none h-16 text-sm transition-colors"
        />
      </div>

      {/* Empty state */}
      {workoutExercises.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
          <div className="h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
            <Dumbbell className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No exercises yet</p>
          <p className="text-xs text-muted-foreground mt-1">Tap "Add exercise" to get started</p>
        </div>
      )}

      {/* Exercise cards — each gets an id so we can scroll to it */}
      {workoutExercises.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          date={date}
          onRemove={() => confirmRemoveExercise(entry.id)}
          onAddSet={() => addSet(entry.id)}
          onRemoveSet={(setId) => removeSet(entry.id, setId)}
          onUpdateSet={(setId, field, value) => updateSet(entry.id, setId, field, value)}
        />
      ))}

      {/* Add exercise search */}
      {showSearch ? (
        <div
          ref={searchContainerRef}
          className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="p-3 border-b border-border">
            <Input
              autoFocus
              placeholder="Search exercises…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              // Re-scroll whenever keyboard pops up and changes visual viewport
              onFocus={() => scrollSearchIntoView(searchContainerRef.current, 300)}
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(groupedExercises).length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No exercises match</p>
            )}
            {Object.entries(groupedExercises).map(([group, exs]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/30 sticky top-0">
                  {group}
                </div>
                {exs.map((ex) => {
                  const isAdded = addedExerciseIds.has(ex.id)
                  const isAdding = addingExerciseId === ex.id
                  return (
                    <button
                      key={ex.id}
                      disabled={isAdded || !!addingExerciseId}
                      onClick={() => handleAddExercise(ex)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/40 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>{ex.name}</span>
                      {isAdding && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {isAdded && !isAdding && <span className="text-xs text-muted-foreground">Added</span>}
                    </button>
                  )
                })}
              </div>
            ))}
            <button
              onClick={() => { setShowSearch(false); setShowCustomModal(true) }}
              className="w-full text-left px-3 py-3 text-sm text-primary hover:bg-secondary/40 flex items-center gap-2 border-t border-border transition-colors"
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
          className="w-full border-dashed transition-colors"
          onClick={openSearch}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add exercise
        </Button>
      )}

      {/* Floating save */}
      <div className="fixed bottom-4 left-0 right-0 px-4 max-w-4xl mx-auto z-30">
        <Button
          className={`w-full h-12 text-base font-semibold shadow-2xl transition-all duration-200 ${saved ? 'opacity-60' : 'opacity-100'}`}
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
            : saved
            ? <>✓ Saved</>
            : <><Save className="h-4 w-4 mr-2" />Save Workout</>
          }
        </Button>
      </div>

      {/* ── Confirm remove exercise ── */}
      <Dialog open={!!confirmRemoveId} onOpenChange={(o) => { if (!o) setConfirmRemoveId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove exercise?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{entryToRemove?.exercise.name}</strong> and all its sets from today's workout. The exercise history won't be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemoveId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doRemoveExercise}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete workout ── */}
      <Dialog open={showDeleteWorkout} onOpenChange={setShowDeleteWorkout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
            <DialogDescription>
              This will permanently delete the entire workout for <strong>{formattedDate}</strong>, including all exercises and sets. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteWorkout(false)} disabled={deletingWorkout}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteWorkout} disabled={deletingWorkout}>
              {deletingWorkout ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : 'Delete workout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Custom exercise modal ── */}
      <Dialog open={showCustomModal} onOpenChange={(o) => { setShowCustomModal(o); if (!o) setCustomName('') }}>
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCustomExercise() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Muscle group</Label>
              <Select value={customMuscleGroup} onValueChange={(v) => setCustomMuscleGroup(v as MuscleGroup)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MUSCLE_GROUPS.map((mg) => <SelectItem key={mg} value={mg}>{mg}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCustomModal(false); setCustomName('') }}>Cancel</Button>
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

function ExerciseCard({ entry, date, onRemove, onAddSet, onRemoveSet, onUpdateSet }: ExerciseCardProps) {
  const [showHistory, setShowHistory] = useState(false)
  const router = useRouter()

  return (
    <div
      id={`exercise-${entry.id}`}
      className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
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
              className={`h-8 w-8 transition-colors ${showHistory ? 'text-primary' : 'text-muted-foreground'}`}
              onClick={() => setShowHistory((v) => !v)}
              title="Show last session"
            >
              <Clock className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Last session panel */}
      {showHistory && entry.lastSession && (
        <div className="px-4 py-3 bg-secondary/20 border-b border-border text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <p className="text-muted-foreground font-medium mb-2">
            Last: {(() => {
              const [y, m, d] = entry.lastSession.date.split('-').map(Number)
              return format(new Date(y, m - 1, d), 'd MMM yyyy')
            })()} · {entry.lastSession.sets.length} sets
          </p>
          <table className="w-full">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium w-8 pb-1">Set</th>
                <th className="text-left font-medium pb-1">Reps</th>
                <th className="text-left font-medium pb-1">Weight</th>
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
        <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 text-xs text-muted-foreground pt-1">
          <span>Set</span>
          <span>Reps</span>
          <span>kg</span>
          <span />
        </div>

        {entry.sets.map((set) => (
          <div key={set.id} className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 items-center animate-in fade-in duration-150">
            <span className="text-sm text-muted-foreground font-mono text-center leading-[44px]">{set.setNumber}</span>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="—"
              value={set.reps}
              onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
              className="h-11 text-center text-base"
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="—"
              value={set.weightKg}
              onChange={(e) => onUpdateSet(set.id, 'weightKg', e.target.value)}
              className="h-11 text-center text-base"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => onRemoveSet(set.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onAddSet}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add set
        </Button>
      </div>
    </div>
  )
}
