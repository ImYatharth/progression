"use client"

import Link from 'next/link'
import { Dumbbell, BookOpen, LayoutDashboard, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Navbar() {
  return (
    <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Dumbbell className="h-5 w-5 text-primary" />
          <span className="text-primary">Progression</span>
        </Link>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <LayoutDashboard className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/templates">
              <ClipboardList className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Templates</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/exercises">
              <BookOpen className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Exercises</span>
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}
