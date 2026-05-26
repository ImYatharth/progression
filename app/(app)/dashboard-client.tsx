"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, addDays } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Flame, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { todayISO } from '@/lib/utils'

export function DashboardClient() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ totalWorkouts: 0, totalSets: 0 })
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, date')
      .gte('date', startDate)
      .lte('date', endDate)

    if (!workouts) { setLoading(false); return }

    setWorkoutDates(new Set(workouts.map((w) => w.date)))

    const workoutIds = workouts.map((w) => w.id)
    let totalSets = 0
    if (workoutIds.length > 0) {
      const { data: wes } = await supabase
        .from('workout_exercises')
        .select('id')
        .in('workout_id', workoutIds)

      if (wes && wes.length > 0) {
        const weIds = wes.map((we) => we.id)
        const { count } = await supabase
          .from('sets')
          .select('id', { count: 'exact', head: true })
          .in('workout_exercise_id', weIds)
        totalSets = count ?? 0
      }
    }

    setStats({ totalWorkouts: workouts.length, totalSets })
    setLoading(false)
  }, [currentDate])

  useEffect(() => { fetchData() }, [fetchData])

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOfWeek = getDay(startOfMonth(currentDate))
  const today = todayISO()

  function goToDay(dateStr: string) {
    router.push(`/workout/${dateStr}`)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{loading ? '—' : stats.totalWorkouts}</p>
            <p className="text-[11px] text-muted-foreground whitespace-nowrap">Sessions this month</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{loading ? '—' : stats.totalSets}</p>
            <p className="text-[11px] text-muted-foreground whitespace-nowrap">Sets this month</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{format(currentDate, 'MMMM yyyy')}</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setCurrentDate(new Date()); goToDay(today) }}
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              Today
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground py-2 font-medium">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const hasWorkout = workoutDates.has(dateStr)
            const isCurrentDay = dateStr === today
            const dayOfWeek = getDay(day) // 0 = Sun, 6 = Sat

            // Streak connectors — only within the same grid row
            const prevDateStr = format(addDays(day, -1), 'yyyy-MM-dd')
            const nextDateStr = format(addDays(day, 1), 'yyyy-MM-dd')
            // Don't connect across row breaks (Sun's left / Sat's right)
            const isLeftConnected = hasWorkout && dayOfWeek !== 0 && workoutDates.has(prevDateStr)
            const isRightConnected = hasWorkout && dayOfWeek !== 6 && workoutDates.has(nextDateStr)

            return (
              <button
                key={dateStr}
                onClick={() => goToDay(dateStr)}
                className={`
                  relative aspect-square flex items-center justify-center text-sm transition-colors
                  hover:bg-secondary/40
                  ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}
                `}
              >
                {/* Left streak connector */}
                {isLeftConnected && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-2 bg-primary/20 pointer-events-none" />
                )}
                {/* Right streak connector */}
                {isRightConnected && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/2 h-2 bg-primary/20 pointer-events-none" />
                )}

                {/* Day number circle */}
                <span
                  className={`
                    relative z-10 h-7 w-7 flex items-center justify-center rounded-full text-sm transition-colors
                    ${isCurrentDay
                      ? 'bg-primary text-primary-foreground font-bold'
                      : hasWorkout
                      ? 'bg-primary/20 text-primary font-semibold'
                      : 'text-foreground'
                    }
                  `}
                >
                  {format(day, 'd')}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
