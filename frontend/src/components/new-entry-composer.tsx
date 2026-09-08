"use client"

import { User } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getEntryPlaceholderText } from "@/lib/entry-placeholder"

interface NewEntryComposerProps {
  onNewEntry?: () => void
  userName?: string
}

// Facebook-style "what's on your mind" bar: sits atop the feed and opens the
// New Entry modal on click, instead of a header button.
export function NewEntryComposer({ onNewEntry, userName }: NewEntryComposerProps) {
  const getInitials = (name?: string) => {
    if (!name) return <User className="size-4" />
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <button
      type="button"
      onClick={onNewEntry}
      className="mb-8 flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <Avatar className="size-10 shrink-0 border-2 border-primary/10">
        <AvatarFallback className="bg-primary/5 text-xs font-bold text-primary">
          {getInitials(userName)}
        </AvatarFallback>
      </Avatar>
      <span className="flex-1 rounded-full bg-muted px-4 py-2.5 text-muted-foreground transition-colors hover:bg-muted/70">
        {getEntryPlaceholderText(userName)}
      </span>
    </button>
  )
}
