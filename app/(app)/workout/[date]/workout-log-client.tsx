"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Plus, Trash2, ChevronLeft, Clock, Save, Loader2, Dumbbell, Timer, ClipboardList, BookmarkPlus } from 'lucide-react'
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
import { getExercises, createCustomExercise, getLastSessionForExercise, getLastSessionsForExercises, saveWorkout, deleteWorkout, getTemplates, createTemplate } from '@/lib/db'
import type { Exercise, MuscleGroup, ExerciseHistorySession, TemplateWithExercises } from '@/types'

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

const NAVBAR_HEIGHT = 56

function scrollCardIntoView(id: string, delay = 120) {
  setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    const vvHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = el.getBoundingClientRect()
    const gap = 12
    const targetTop = NAVBAR_HEIGHT + gap
    if (rect.top >= targetTop && rect.bottom <= vvHeight - gap) return
    window.scrollTo({ top: window.scrollY + rect.top - targetTop, behavior: 'smooth' })
  }, delay)
}

function scrollSearchIntoView(el: HTMLElement | null, delay = 80) {
  if (!el) return
  setTimeout(() => {
    const vvHeight = window.visualViewport?.height ?? window.innerHeight
    const rect = el.getBoundingClientRect()
    const gap = 12
    const targetTop = NAVBAR_HEIGHT + gap
    if (rect.top >= targetTop && rect.bottom <= vvHeight - gap) return
    window.scrollTo({ top: window.scrollY + rect.top - targetTop, behavior: 'smooth' })
  }, delay)
}

// Move focus to the next number input inside the same exercise card, or
// blur if we're at the last input. Lets the user chain through reps → kg
// → next-set's reps without ever dismissing the keyboard.
function focusNextInput(currentInput: HTMLInputElement) {
  const card = currentInput.closest('[data-exercise-card]')
  if (!card) return
  const inputs = Array.from(
    card.querySelectorAll<HTMLInputElement>('input[data-set-input]')
  )
  const idx = inputs.indexOf(currentInput)
  if (idx >= 0 && idx < inputs.length - 1) {
    inputs[idx + 1].focus()
  } else {
    currentInput.blur()
  }
}

type ExerciseMode = 'reps' | 'time'

interface SetRow {
  id: string
  setNumber: number
  reps: string
  weightKg: string
  // In 'time' mode this field stores MINUTES (as a display string, e.g. "30").
  // In 'reps' mode it is always empty / ignored.
  durationMinutes: string
}

interface WorkoutExerciseEntry {
  id: string
  exercise: Exercise
  sets: SetRow[]
  lastSession: ExerciseHistorySession | null
  mode: ExerciseMode
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
  const [lastAddedId, setLastAddedId] = useState<string | null>(null)
  const [focusSetId, setFocusSetId] = useState<string | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const [showDeleteWorkout, setShowDeleteWorkout] = useState(false)
  const [deletingWorkout, setDeletingWorkout] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customMuscleGroup, setCustomMuscleGroup] = useState<MuscleGroup>('Chest')

  // Templates
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [templates, setTemplates] = useState<TemplateWithExercises[] | null>(null)
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const formattedDate = (() => {
    try {
      const [y, m, d] = date.split('-').map(Number)
      return format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy')
    } catch { return date }
  })()

  const workoutExists = workoutExercises.length > 0

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setSaved(false)
  }, [workoutExercises, notes])

  useEffect(() => {
    if (!lastAddedId) return
    scrollCardIntoView(`exercise-${lastAddedId}`)
    setLastAddedId(null)
  }, [lastAddedId, workoutExercises])

  // Detect on-screen keyboard via visualViewport so we can hide the
  // floating Save button (otherwise it gets covered by the keyboard
  // and feels janky on iOS).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const diff = window.innerHeight - vv.height
      setKeyboardOpen(diff > 150)
    }
    vv.addEventListener('resize', onResize)
    onResize()
    return () => vv.removeEventListener('resize', onResize)
  }, [])

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
          // One batched query for every exercise's last session instead of
          // one query per exercise.
          const lastSessions = await getLastSessionsForExercises(
            wes.map((we) => we.exercise.id),
            date
          )

          const entries: WorkoutExerciseEntry[] = wes.map((we) => {
            const rawSets: Array<{
              set_number: number
              reps: number | null
              weight_kg: number | null
              duration_seconds: number | null
            }> = (we.sets || []).sort(
              (a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number
            )

            // Determine mode: if any set has duration_seconds, treat as time mode.
            // Also default cardio to time mode.
            const hasTimeSets = rawSets.some((s) => s.duration_seconds != null && s.duration_seconds > 0)
            const mode: ExerciseMode =
              we.exercise.muscle_group === 'Cardio' || hasTimeSets ? 'time' : 'reps'

            const sortedSets: SetRow[] = rawSets.map((s) => ({
              id: crypto.randomUUID(),
              setNumber: s.set_number,
              reps: s.reps?.toString() ?? '',
              weightKg: s.weight_kg?.toString() ?? '',
              // Convert seconds → minutes for display in time mode
              durationMinutes:
                mode === 'time' && s.duration_seconds != null
                  ? (s.duration_seconds / 60).toString()
                  : '',
            }))

            const lastSession = lastSessions[we.exercise.id] ?? null
            return { id: crypto.randomUUID(), exercise: we.exercise, sets: sortedSets, lastSession, mode }
          })
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
    scrollSearchIntoView(searchContainerRef.current, 100)
  }

  async function handleAddExercise(exercise: Exercise) {
    if (addedExerciseIds.has(exercise.id)) return
    setAddingExerciseId(exercise.id)
    const lastSession = await getLastSessionForExercise(exercise.id, date)
    const newId = crypto.randomUUID()
    const mode: ExerciseMode = exercise.muscle_group === 'Cardio' ? 'time' : 'reps'
    setWorkoutExercises((prev) => [
      ...prev,
      {
        id: newId,
        exercise,
        sets: [{ id: crypto.randomUUID(), setNumber: 1, reps: '', weightKg: '', durationMinutes: '' }],
        lastSession,
        mode,
      },
    ])
    setAddingExerciseId(null)
    setShowSearch(false)
    setSearchQuery('')
    setLastAddedId(newId)
  }

  async function openTemplatePicker() {
    setShowTemplatePicker(true)
    if (templates === null) {
      try {
        setTemplates(await getTemplates())
      } catch {
        setTemplates([])
        toast({
          title: 'Could not load templates',
          description: 'Make sure the templates tables exist in Supabase (run supabase/templates.sql).',
          variant: 'destructive',
        })
      }
    }
  }

  async function handleApplyTemplate(template: TemplateWithExercises) {
    setApplyingTemplateId(template.id)
    // Merge: skip exercises already in today's workout so applying twice
    // (or stacking two templates) never duplicates anything.
    const toAdd = template.template_exercises.filter((te) => !addedExerciseIds.has(te.exercise.id))
    const entries: WorkoutExerciseEntry[] = await Promise.all(
      toAdd.map(async (te) => {
        const lastSession = await getLastSessionForExercise(te.exercise.id, date)
        const mode: ExerciseMode = te.exercise.muscle_group === 'Cardio' ? 'time' : 'reps'
        return {
          id: crypto.randomUUID(),
          exercise: te.exercise,
          sets: Array.from({ length: te.default_sets }, (_, i) => ({
            id: crypto.randomUUID(),
            setNumber: i + 1,
            reps: '',
            weightKg: '',
            durationMinutes: '',
          })),
          lastSession,
          mode,
        }
      })
    )
    setWorkoutExercises((prev) => [...prev, ...entries])
    setApplyingTemplateId(null)
    setShowTemplatePicker(false)
    if (entries.length > 0) {
      setLastAddedId(entries[0].id)
      toast({ title: `✓ ${template.name} added`, description: `${entries.length} exercise${entries.length !== 1 ? 's' : ''}` })
    } else {
      toast({ title: 'Nothing to add', description: 'All exercises from this template are already in today\'s workout' })
    }
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim() || workoutExercises.length === 0) return
    setSavingTemplate(true)
    try {
      await createTemplate(
        templateName.trim(),
        workoutExercises.map((we) => ({ exerciseId: we.exercise.id, defaultSets: Math.max(1, we.sets.length) }))
      )
      setTemplates(null) // refetch next time the picker opens
      setShowSaveTemplate(false)
      setTemplateName('')
      toast({ title: '✓ Template saved' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' })
    }
    setSavingTemplate(false)
  }

  function toggleMode(entryId: string, mode: ExerciseMode) {
    setWorkoutExercises((prev) =>
      prev.map((we) => (we.id === entryId ? { ...we, mode } : we))
    )
  }

  function confirmRemoveExercise(entryId: string) { setConfirmRemoveId(entryId) }

  function doRemoveExercise() {
    if (!confirmRemoveId) return
    setWorkoutExercises((prev) => prev.filter((we) => we.id !== confirmRemoveId))
    setConfirmRemoveId(null)
  }

  function addSet(entryId: string) {
    const newSetId = crypto.randomUUID()
    setWorkoutExercises((prev) =>
      prev.map((we) => {
        if (we.id !== entryId) return we
        const lastSet = we.sets[we.sets.length - 1]
        return {
          ...we,
          sets: [
            ...we.sets,
            {
              id: newSetId,
              setNumber: we.sets.length + 1,
              // Copy values from the previous set
              reps: lastSet?.reps ?? '',
              weightKg: lastSet?.weightKg ?? '',
              durationMinutes: lastSet?.durationMinutes ?? '',
            },
          ],
        }
      })
    )
    // Trigger auto-focus on the new set's first input so the user can
    // start typing immediately without a tap.
    setFocusSetId(newSetId)
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
            // Time mode: save duration in seconds, null out reps/weight
            reps: we.mode === 'reps' ? (s.reps ? parseInt(s.reps) : null) : null,
            weightKg: we.mode === 'reps' ? (s.weightKg ? parseFloat(s.weightKg) : null) : null,
            // Convert minutes → seconds on save
            durationSeconds:
              we.mode === 'time' ? (s.durationMinutes ? Math.round(parseFloat(s.durationMinutes) * 60) : null) : null,
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
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setShowSaveTemplate(true)}
              title="Save as template"
            >
              <BookmarkPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => setShowDeleteWorkout(true)}
              title="Delete workout"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Add exercise — top placement so it's reachable without scrolling
          past every logged exercise */}
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
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-dashed transition-colors" onClick={openSearch}>
            <Plus className="h-4 w-4 mr-2" />
            Add exercise
          </Button>
          <Button variant="outline" className="flex-1 border-dashed transition-colors" onClick={openTemplatePicker}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Use template
          </Button>
        </div>
      )}

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

      {/* Exercise cards */}
      {workoutExercises.map((entry) => (
        <ExerciseCard
          key={entry.id}
          entry={entry}
          focusSetId={focusSetId}
          onFocusConsumed={() => setFocusSetId(null)}
          onRemove={() => confirmRemoveExercise(entry.id)}
          onAddSet={() => addSet(entry.id)}
          onRemoveSet={(setId) => removeSet(entry.id, setId)}
          onUpdateSet={(setId, field, value) => updateSet(entry.id, setId, field, value)}
          onToggleMode={(mode) => toggleMode(entry.id, mode)}
        />
      ))}

      {/* Floating save — slides out of the way when the keyboard is open
          so it doesn't fight with the visual viewport on iOS. */}
      <div
        className={`fixed bottom-4 left-0 right-0 px-4 max-w-4xl mx-auto z-30 transition-all duration-200 ${
          keyboardOpen ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
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

      {/* Confirm remove exercise */}
      <Dialog open={!!confirmRemoveId} onOpenChange={(o) => { if (!o) setConfirmRemoveId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove exercise?</DialogTitle>
            <DialogDescription>
              This will remove <strong>{entryToRemove?.exercise.name}</strong> and all its sets from today's workout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemoveId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doRemoveExercise}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete workout */}
      <Dialog open={showDeleteWorkout} onOpenChange={setShowDeleteWorkout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete workout?</DialogTitle>
            <DialogDescription>
              Permanently delete the entire workout for <strong>{formattedDate}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteWorkout(false)} disabled={deletingWorkout}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteWorkout} disabled={deletingWorkout}>
              {deletingWorkout ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : 'Delete workout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template picker */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Use template</DialogTitle>
            <DialogDescription>
              Adds the template's exercises with empty sets. Exercises already in today's workout are skipped.
            </DialogDescription>
          </DialogHeader>
          {templates === null ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">
              No templates yet. Create one in the Templates tab, or save this workout as a template.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {templates.map((t) => (
                <button
                  key={t.id}
                  disabled={!!applyingTemplateId}
                  onClick={() => handleApplyTemplate(t)}
                  className="w-full text-left bg-secondary/30 hover:bg-secondary/50 rounded-lg px-3 py-2.5 transition-colors disabled:opacity-50 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.template_exercises.map((te) => te.exercise.name).join(' · ')}
                    </p>
                  </div>
                  {applyingTemplateId === t.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save as template */}
      <Dialog open={showSaveTemplate} onOpenChange={(o) => { setShowSaveTemplate(o); if (!o) setTemplateName('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Saves today's {workoutExercises.length} exercise{workoutExercises.length !== 1 ? 's' : ''} (and set counts) as a reusable template. Weights and reps are not saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Template name</Label>
            <Input
              autoFocus
              placeholder="e.g. Push Day"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate() }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)} disabled={savingTemplate}>Cancel</Button>
            <Button onClick={handleSaveAsTemplate} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom exercise modal */}
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
  focusSetId: string | null
  onFocusConsumed: () => void
  onRemove: () => void
  onAddSet: () => void
  onRemoveSet: (setId: string) => void
  onUpdateSet: (setId: string, field: keyof SetRow, value: string) => void
  onToggleMode: (mode: ExerciseMode) => void
}

function ExerciseCard({
  entry,
  focusSetId,
  onFocusConsumed,
  onRemove,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleMode,
}: ExerciseCardProps) {
  const [showHistory, setShowHistory] = useState(false)
  const router = useRouter()
  const { mode } = entry
  const cardRef = useRef<HTMLDivElement>(null)

  // When a newly-added set asks for focus, find its first input and
  // focus it. select() so typing replaces the copied-from-previous value.
  useEffect(() => {
    if (!focusSetId) return
    if (!entry.sets.some((s) => s.id === focusSetId)) return
    const input = cardRef.current?.querySelector<HTMLInputElement>(
      `input[data-set-id="${focusSetId}"]`
    )
    if (input) {
      // Slight delay lets the new row finish mounting + animating
      setTimeout(() => {
        input.focus()
        input.select()
      }, 60)
    }
    onFocusConsumed()
  }, [focusSetId, entry.sets, onFocusConsumed])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      focusNextInput(e.currentTarget)
    }
  }, [])

  const handleFocusSelect = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // select-all on focus → tapping into a copied-value field lets the
    // user immediately overwrite without backspacing.
    e.currentTarget.select()
  }, [])

  return (
    <div
      ref={cardRef}
      data-exercise-card
      id={`exercise-${entry.id}`}
      className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header — two rows so the exercise name has full width */}
      <div className="px-3 pt-3 pb-2 border-b border-border space-y-2">
        {/* Row 1: name + action icons */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => router.push(`/exercise/${entry.exercise.id}`)}
            className="font-semibold text-sm text-left hover:text-primary transition-colors min-w-0 flex-1 leading-tight pt-1.5"
          >
            {entry.exercise.name}
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
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

        {/* Row 2: muscle group badge + Reps/Time toggle */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${MUSCLE_GROUP_COLORS[entry.exercise.muscle_group as MuscleGroup]}`}>
            {entry.exercise.muscle_group}
          </span>

          <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0 text-xs">
            <button
              onClick={() => onToggleMode('reps')}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                mode === 'reps' ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Reps
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => onToggleMode('time')}
              className={`flex items-center gap-1 px-2.5 py-1.5 transition-colors ${
                mode === 'time' ? 'bg-primary/20 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Timer className="h-3 w-3" />
              Time
            </button>
          </div>
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
                {mode === 'time' ? (
                  <th className="text-left font-medium pb-1">Duration</th>
                ) : (
                  <>
                    <th className="text-left font-medium pb-1">Reps</th>
                    <th className="text-left font-medium pb-1">Weight</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {entry.lastSession.sets.map((s) => (
                <tr key={s.id}>
                  <td className="py-0.5 text-muted-foreground">{s.set_number}</td>
                  {mode === 'time' ? (
                    <td className="py-0.5">
                      {s.duration_seconds != null ? `${(s.duration_seconds / 60).toFixed(1)} min` : '—'}
                    </td>
                  ) : (
                    <>
                      <td className="py-0.5">{s.reps ?? '—'}</td>
                      <td className="py-0.5">{s.weight_kg != null ? `${s.weight_kg} kg` : '—'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Set rows */}
      <div className="px-4 py-2 space-y-2">
        {mode === 'reps' ? (
          <>
            <div className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 text-xs text-muted-foreground pt-1">
              <span>Set</span><span>Reps</span><span>kg</span><span />
            </div>
            {entry.sets.map((set, idx) => {
              const isLastSet = idx === entry.sets.length - 1
              return (
                <div key={set.id} className="grid grid-cols-[32px_1fr_1fr_36px] gap-2 items-center animate-in fade-in duration-150">
                  <span className="text-sm text-muted-foreground font-mono text-center leading-[44px]">{set.setNumber}</span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="—"
                    data-set-input
                    data-set-id={set.id}
                    value={set.reps}
                    onChange={(e) => onUpdateSet(set.id, 'reps', e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocusSelect}
                    enterKeyHint="next"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11 text-center text-base"
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    data-set-input
                    value={set.weightKg}
                    onChange={(e) => onUpdateSet(set.id, 'weightKg', e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocusSelect}
                    enterKeyHint={isLastSet ? 'done' : 'next'}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11 text-center text-base"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors" onClick={() => onRemoveSet(set.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </>
        ) : (
          <>
            <div className="grid grid-cols-[32px_1fr_36px] gap-2 text-xs text-muted-foreground pt-1">
              <span>Set</span><span>Duration (min)</span><span />
            </div>
            {entry.sets.map((set, idx) => {
              const isLastSet = idx === entry.sets.length - 1
              return (
                <div key={set.id} className="grid grid-cols-[32px_1fr_36px] gap-2 items-center animate-in fade-in duration-150">
                  <span className="text-sm text-muted-foreground font-mono text-center leading-[44px]">{set.setNumber}</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 30"
                    data-set-input
                    data-set-id={set.id}
                    value={set.durationMinutes}
                    onChange={(e) => onUpdateSet(set.id, 'durationMinutes', e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleFocusSelect}
                    enterKeyHint={isLastSet ? 'done' : 'next'}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-11 text-center text-base"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive transition-colors" onClick={() => onRemoveSet(set.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            })}
          </>
        )}

        <Button
          variant="ghost" size="sm"
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
