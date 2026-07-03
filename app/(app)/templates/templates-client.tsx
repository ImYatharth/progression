"use client"

import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Minus, ClipboardList, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getExercises } from '@/lib/db'
import type { Exercise, MuscleGroup, TemplateWithExercises } from '@/types'

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

interface DraftExercise {
  exercise: Exercise
  defaultSets: number
}

export function TemplatesClient() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  // Builder state — doubles as the editor. editingId null = creating new.
  const [building, setBuilding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([getTemplates(), getExercises()])
      .then(([tps, exs]) => {
        setTemplates(tps)
        setExercises(exs)
      })
      .catch(() => {
        toast({
          title: 'Could not load templates',
          description: 'Make sure the templates tables exist in Supabase (run supabase/templates.sql).',
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [toast])

  const draftIds = new Set(draftExercises.map((d) => d.exercise.id))
  const filteredExercises = exercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.muscle_group.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const groupedExercises = MUSCLE_GROUPS.reduce<Record<string, Exercise[]>>((acc, mg) => {
    const group = filteredExercises.filter((ex) => ex.muscle_group === mg)
    if (group.length > 0) acc[mg] = group
    return acc
  }, {})

  function resetBuilder() {
    setBuilding(false)
    setEditingId(null)
    setDraftName('')
    setDraftExercises([])
    setShowPicker(false)
    setSearchQuery('')
  }

  function startCreate() {
    setEditingId(null)
    setDraftName('')
    setDraftExercises([])
    setShowPicker(false)
    setSearchQuery('')
    setBuilding(true)
  }

  function startEdit(template: TemplateWithExercises) {
    setEditingId(template.id)
    setDraftName(template.name)
    setDraftExercises(
      template.template_exercises.map((te) => ({ exercise: te.exercise, defaultSets: te.default_sets }))
    )
    setShowPicker(false)
    setSearchQuery('')
    setBuilding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function adjustSets(exerciseId: string, delta: number) {
    setDraftExercises((prev) =>
      prev.map((d) =>
        d.exercise.id === exerciseId
          ? { ...d, defaultSets: Math.min(10, Math.max(1, d.defaultSets + delta)) }
          : d
      )
    )
  }

  async function handleSaveTemplate() {
    if (!draftName.trim() || draftExercises.length === 0) return
    setSavingDraft(true)
    try {
      const exercisePayload = draftExercises.map((d) => ({ exerciseId: d.exercise.id, defaultSets: d.defaultSets }))
      if (editingId) {
        await updateTemplate(editingId, draftName.trim(), exercisePayload)
      } else {
        await createTemplate(draftName.trim(), exercisePayload)
      }
      const tps = await getTemplates()
      setTemplates(tps)
      const wasEditing = !!editingId
      resetBuilder()
      toast({ title: wasEditing ? '✓ Template updated' : '✓ Template saved' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save template', variant: 'destructive' })
    }
    setSavingDraft(false)
  }

  async function handleDelete() {
    if (!confirmDeleteId) return
    setDeleting(true)
    try {
      await deleteTemplate(confirmDeleteId)
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDeleteId))
      toast({ title: 'Template deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' })
    }
    setDeleting(false)
    setConfirmDeleteId(null)
  }

  const templateToDelete = templates.find((t) => t.id === confirmDeleteId)

  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="h-6 w-32 rounded bg-secondary animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Templates</h1>
        {!building && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            New template
          </Button>
        )}
      </div>

      {/* Builder / editor */}
      {building && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <p className="text-sm font-semibold">{editingId ? 'Edit template' : 'New template'}</p>
          <div className="space-y-1.5">
            <Label>Template name</Label>
            <Input
              autoFocus
              placeholder="e.g. Push Day"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>

          {/* Chosen exercises */}
          {draftExercises.length > 0 && (
            <div className="space-y-2">
              {draftExercises.map((d) => (
                <div key={d.exercise.id} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2 animate-in fade-in duration-150">
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">{d.exercise.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustSets(d.exercise.id, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground w-12 text-center">{d.defaultSets} set{d.defaultSets !== 1 ? 's' : ''}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => adjustSets(d.exercise.id, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setDraftExercises((prev) => prev.filter((x) => x.exercise.id !== d.exercise.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Exercise picker */}
          {showPicker ? (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="p-2 border-b border-border">
                <Input
                  autoFocus
                  placeholder="Search exercises…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {Object.entries(groupedExercises).length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">No exercises match</p>
                )}
                {Object.entries(groupedExercises).map(([group, exs]) => (
                  <div key={group}>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-secondary/30 sticky top-0">
                      {group}
                    </div>
                    {exs.map((ex) => {
                      const isAdded = draftIds.has(ex.id)
                      return (
                        <button
                          key={ex.id}
                          disabled={isAdded}
                          onClick={() => {
                            setDraftExercises((prev) => [...prev, { exercise: ex, defaultSets: 3 }])
                            setShowPicker(false)
                            setSearchQuery('')
                          }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-secondary/40 flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <span>{ex.name}</span>
                          {isAdded && <span className="text-xs text-muted-foreground">Added</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => { setShowPicker(false); setSearchQuery('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setShowPicker(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add exercise
            </Button>
          )}

          {/* Builder actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={resetBuilder} disabled={savingDraft}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveTemplate}
              disabled={savingDraft || !draftName.trim() || draftExercises.length === 0}
            >
              {savingDraft
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                : editingId ? 'Save changes' : 'Save template'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!building && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No templates yet</p>
          <p className="text-xs text-muted-foreground mt-1 text-center px-6">
            Create one here, or save a logged workout as a template from the workout page
          </p>
        </div>
      )}

      {/* Template list (the one being edited is hidden — it lives in the editor above) */}
      {templates.filter((t) => t.id !== editingId).map((t, idx) => (
        <div
          key={t.id}
          className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{ animationDelay: `${idx * 40}ms` }}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm min-w-0 truncate">{t.name}</h2>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="text-xs text-muted-foreground mr-1">
                {t.template_exercises.length} exercise{t.template_exercises.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                onClick={() => startEdit(t)}
                disabled={building}
                title="Edit template"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => setConfirmDeleteId(t.id)}
                title="Delete template"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="px-4 py-2 divide-y divide-border/40">
            {t.template_exercises.map((te) => (
              <div key={te.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">{te.exercise.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${MUSCLE_GROUP_COLORS[te.exercise.muscle_group as MuscleGroup]}`}>
                    {te.exercise.muscle_group}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">{te.default_sets} set{te.default_sets !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Confirm delete */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{templateToDelete?.name}</strong>? Past workouts are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
