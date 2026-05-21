"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronLeft, TrendingUp, Dumbbell } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { getExerciseById, getExerciseHistory } from '@/lib/db'
import type { Exercise, ExerciseHistorySession } from '@/types'

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: 'bg-red-900/40 text-red-300 border-red-800',
  Back: 'bg-blue-900/40 text-blue-300 border-blue-800',
  Legs: 'bg-green-900/40 text-green-300 border-green-800',
  Shoulders: 'bg-purple-900/40 text-purple-300 border-purple-800',
  Arms: 'bg-orange-900/40 text-orange-300 border-orange-800',
  Core: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  Cardio: 'bg-cyan-900/40 text-cyan-300 border-cyan-800',
}

interface ExerciseHistoryClientProps {
  exerciseId: string
}

export function ExerciseHistoryClient({ exerciseId }: ExerciseHistoryClientProps) {
  const router = useRouter()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [sessions, setSessions] = useState<ExerciseHistorySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [ex, hist] = await Promise.all([
        getExerciseById(exerciseId),
        getExerciseHistory(exerciseId),
      ])
      setExercise(ex)
      // getExerciseHistory returns oldest-first; reverse for display (newest first)
      setSessions([...hist].reverse())
      setLoading(false)
    }
    load()
  }, [exerciseId])

  // Chart needs oldest-first (ascending date)
  const chartData = [...sessions]
    .reverse()
    .map((session) => {
      const weights = session.sets.map((s) => s.weight_kg ?? 0).filter((w) => w > 0)
      const maxWeight = weights.length > 0 ? Math.max(...weights) : null
      const [y, m, d] = session.date.split('-').map(Number)
      return {
        date: format(new Date(y, m - 1, d), 'd MMM'),
        maxWeight,
      }
    })
    .filter((d) => d.maxWeight !== null)

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-secondary animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 rounded bg-secondary animate-pulse" />
            <div className="h-3.5 w-20 rounded bg-secondary animate-pulse" />
          </div>
        </div>
        <div className="h-56 rounded-xl bg-secondary animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="text-center py-16 animate-in fade-in duration-300">
        <p className="text-muted-foreground">Exercise not found.</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">Go back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2.5 min-w-0">
          <div>
            <h1 className="text-xl font-bold">{exercise.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${MUSCLE_GROUP_COLORS[exercise.muscle_group] ?? 'bg-secondary text-foreground border-border'}`}>
                {exercise.muscle_group}
              </span>
              {sessions.length > 0 && (
                <span className="text-xs text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl animate-in fade-in duration-300">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center mb-3">
            <Dumbbell className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">No sessions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Log this exercise in a workout to see history</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Max weight over time</h2>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      axisLine={{ stroke: '#2A2A2A' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 11 }}
                      axisLine={{ stroke: '#2A2A2A' }}
                      tickLine={false}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#E5E7EB', marginBottom: '2px' }}
                      itemStyle={{ color: '#E8FF47' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="#E8FF47"
                      strokeWidth={2}
                      dot={{ fill: '#E8FF47', r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      name="Max weight (kg)"
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sessions list */}
          <div className="space-y-3">
            {sessions.map((session, idx) => {
              const [y, m, d] = session.date.split('-').map(Number)
              const maxWeight = Math.max(...session.sets.map((s) => s.weight_kg ?? 0).filter((w) => w > 0))
              return (
                <div
                  key={session.workout_id}
                  className="bg-card border border-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <button
                      onClick={() => router.push(`/workout/${session.date}`)}
                      className="font-semibold text-sm hover:text-primary transition-colors text-left"
                    >
                      {format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy')}
                    </button>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {maxWeight > 0 && (
                        <span className="text-xs text-primary font-semibold">{maxWeight} kg</span>
                      )}
                      <span className="text-xs text-muted-foreground">{session.sets.length} sets</span>
                    </div>
                  </div>
                  <div className="px-4 py-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="text-left font-medium pb-2 w-10">Set</th>
                          <th className="text-left font-medium pb-2">Reps</th>
                          <th className="text-left font-medium pb-2">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.sets.map((s) => (
                          <tr key={s.id} className="border-t border-border/40">
                            <td className="py-1.5 text-muted-foreground">{s.set_number}</td>
                            <td className="py-1.5">{s.reps ?? '—'}</td>
                            <td className="py-1.5">
                              {s.weight_kg != null
                                ? `${s.weight_kg} kg`
                                : s.duration_seconds != null
                                ? `${s.duration_seconds}s`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
