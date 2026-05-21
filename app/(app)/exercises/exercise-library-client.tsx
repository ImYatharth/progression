"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { getExercises, createCustomExercise } from '@/lib/db'
import type { Exercise, MuscleGroup } from '@/types'

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

export function ExerciseLibraryClient() {
  const router = useRouter()
  const { toast } = useToast()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<MuscleGroup | 'All'>('All')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customGroup, setCustomGroup] = useState<MuscleGroup>('Chest')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getExercises().then((data) => {
      setExercises(data)
      setLoading(false)
    })
  }, [])

  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = filterGroup === 'All' || ex.muscle_group === filterGroup
    return matchesSearch && matchesGroup
  })

  async function handleCreate() {
    if (!customName.trim()) return
    setCreating(true)
    try {
      const ex = await createCustomExercise(customName.trim(), customGroup)
      setExercises((prev) => [...prev, ex])
      setShowModal(false)
      setCustomName('')
      toast({ title: 'Exercise created!' })
    } catch {
      toast({ title: 'Error', description: 'Failed to create exercise', variant: 'destructive' })
    }
    setCreating(false)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Exercise Library</h1>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add custom
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterGroup} onValueChange={(v) => setFilterGroup(v as MuscleGroup | 'All')}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All groups</SelectItem>
            {MUSCLE_GROUPS.map((mg) => (
              <SelectItem key={mg} value={mg}>{mg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{filtered.length} exercises</p>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No exercises found.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((ex) => (
            <button
              key={ex.id}
              onClick={() => router.push(`/exercise/${ex.id}`)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium text-sm truncate">{ex.name}</span>
                {ex.is_custom && (
                  <span className="text-xs text-muted-foreground shrink-0">custom</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${MUSCLE_GROUP_COLORS[ex.muscle_group as MuscleGroup]}`}>
                  {ex.muscle_group}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
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
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Muscle group</Label>
              <Select value={customGroup} onValueChange={(v) => setCustomGroup(v as MuscleGroup)}>
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
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !customName.trim()}>
              {creating ? 'Creating…' : 'Add exercise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
