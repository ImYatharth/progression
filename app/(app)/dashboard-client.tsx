"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays, Flame, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { todayISO } from '@/lib/utils'

interface DashboardClientProps {
  userId: string
}

export function DashboardClient({ userId }: DashboardClientProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState({ totalWorkouts: 0, totalSets: 0 })
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: workouts } = await supabase
      .from('workouts')
      .select('id, date')
      .eq('user_id', userId)
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
  }, [currentDate, userId])

  useEffect(() => { fetchData() }, [fetchData])

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOfWeek = getDay(startOfMonth(currentDate))
  const today = todayISO()

  function goToDay(dateStr: string) {
    router.push(`/workout/${dateStr}`)
  }

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{loading ? '—' : stats.totalWorkouts}</p>
            <p className="text-xs text-muted-foreground">Workouts this month</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{loading ? '—' : stats.totalSets}</p>
            <p className="text-xs text-muted-foreground">Sets this month</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Calendar header */}
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
              onClick={() => {
                setCurrentDate(new Date())
                goToDay(today)
              }}
            >
              <CalendarDays className="h-3 w-3 mr-1" />
              Today
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-border">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const hasWorkout = workoutDates.has(dateStr)
            const isCurrentDay = dateStr === today

            return (
              <button
                key={dateStr}
                onClick={() => goToDay(dateStr)}
                className={`
                  aspect-square flex flex-col items-center justify-center text-sm relative transition-colors
                  hover:bg-secondary/60
                  ${!isSameMonth(day, currentDate) ? 'text-muted-foreground/30' : ''}
                  ${isCurrentDay ? 'font-bold' : ''}
                `}
              >
                <span className={`
                  h-7 w-7 flex items-center justify-center rounded-full text-sm
                  ${isCurrentDay ? 'bg-primary text-primary-foreground' : ''}
                `}>
                  {format(day, 'd')}
                </span>
                {hasWorkout && (
                  <span className={`h-1.5 w-1.5 rounded-full mt-0.5 ${isCurrentDay ? 'bg-primary-foreground/70' : 'bg-primary'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
