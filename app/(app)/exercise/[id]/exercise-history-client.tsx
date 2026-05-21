"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronLeft, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { getExerciseById, getExerciseHistory } from '@/lib/db'
import type { Exercise, ExerciseHistorySession } from '@/types'

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
      setSessions(hist.reverse()) // most recent first for display, ascending for chart
      setLoading(false)
    }
    load()
  }, [exerciseId])

  const chartData = [...sessions]
    .reverse()
    .map((session) => {
      const maxWeight = Math.max(...session.sets.map((s) => s.weight_kg ?? 0))
      const [y, m, d] = session.date.split('-').map(Number)
      return {
        date: format(new Date(y, m - 1, d), 'd MMM'),
        maxWeight: maxWeight > 0 ? maxWeight : null,
      }
    })
    .filter((d) => d.maxWeight !== null)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (!exercise) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Exercise not found.</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">Go back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{exercise.name}</h1>
          <p className="text-sm text-muted-foreground">{exercise.muscle_group}</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <p className="text-muted-foreground">No sessions logged yet.</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          {chartData.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-4">
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
                      contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
                      labelStyle={{ color: '#E5E7EB' }}
                      itemStyle={{ color: '#E8FF47' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="maxWeight"
                      stroke="#E8FF47"
                      strokeWidth={2}
                      dot={{ fill: '#E8FF47', r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Max weight (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Sessions */}
          <div className="space-y-3">
            {sessions.map((session) => {
              const [y, m, d] = session.date.split('-').map(Number)
              return (
                <div key={session.workout_id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <button
                      onClick={() => router.push(`/workout/${session.date}`)}
                      className="font-semibold text-sm hover:text-primary transition-colors"
                    >
                      {format(new Date(y, m - 1, d), 'EEEE, d MMMM yyyy')}
                    </button>
                    <span className="text-xs text-muted-foreground">{session.sets.length} sets</span>
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
                          <tr key={s.id} className="border-t border-border/50">
                            <td className="py-1.5 text-muted-foreground">{s.set_number}</td>
                            <td className="py-1.5">{s.reps ?? '—'}</td>
                            <td className="py-1.5">{s.weight_kg != null ? `${s.weight_kg} kg` : s.duration_seconds != null ? `${s.duration_seconds}s` : '—'}</td>
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
