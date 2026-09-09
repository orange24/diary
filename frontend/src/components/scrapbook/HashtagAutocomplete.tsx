"use client"

import { Hash } from "lucide-react"

interface HashtagAutocompleteProps {
  query: string
  hashtags: string[]
  position: { top: number; left: number }
  onSelect: (tag: string) => void
}

// Same idea as MentionAutocomplete, suggesting hashtags already used
// elsewhere in the user's entries instead of friends.
export function HashtagAutocomplete({ query, hashtags, position, onSelect }: HashtagAutocompleteProps) {
  const q = query.toLowerCase()
  const matches = hashtags.filter((tag) => tag.toLowerCase().includes(q)).slice(0, 6)

  if (matches.length === 0) return null

  return (
    <div
      // pointer-events-auto: while the entry dialog is open, Radix sets
      // pointer-events:none on <body> so only the dialog's own content stays
      // clickable. This popover is portaled straight to <body> (to escape
      // the scrapbook canvas's transform), so it inherits that none and is
      // otherwise visible but unclickable without this override.
      className="fixed z-[200] w-56 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg pointer-events-auto"
      style={{ top: position.top, left: position.left }}
    >
      {matches.map((tag) => (
        <button
          key={tag}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(tag)
          }}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <Hash className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold text-popover-foreground">{tag}</span>
        </button>
      ))}
    </div>
  )
}
