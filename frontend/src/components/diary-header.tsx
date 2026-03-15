"use client"

import { Button } from "@/components/ui/button"
import { Plus, BookOpen } from "lucide-react"

interface DiaryHeaderProps {
  onNewEntry?: () => void
}

export function DiaryHeader({ onNewEntry }: DiaryHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary">
              <BookOpen className="size-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              My Daily Diary
            </h1>
          </div>
          <Button onClick={onNewEntry} className="gap-2">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New Entry</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
