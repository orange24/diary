"use client"

import { FriendUser } from "@/services/friends"

interface MentionAutocompleteProps {
  query: string
  friends: FriendUser[]
  position: { top: number; left: number }
  onSelect: (friend: FriendUser) => void
}

// Floating suggestion list anchored at the caret while typing "@" inside a
// scrapbook text box. onMouseDown (not onClick) + preventDefault stops the
// contentEditable from losing focus/blurring before the selection commits.
export function MentionAutocomplete({ query, friends, position, onSelect }: MentionAutocompleteProps) {
  const q = query.toLowerCase()
  const matches = friends
    .filter((f) => f.username.toLowerCase().includes(q) || f.full_name.toLowerCase().includes(q))
    .slice(0, 6)

  if (matches.length === 0) return null

  return (
    <div
      // pointer-events-auto: while the entry dialog is open, Radix sets
      // pointer-events:none on <body> so only the dialog's own content stays
      // clickable. This popover is portaled straight to <body> (to escape
      // the scrapbook canvas's transform), so it inherits that none and is
      // otherwise visible but unclickable without this override.
      className="fixed z-[200] w-60 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg pointer-events-auto"
      style={{ top: position.top, left: position.left }}
    >
      {matches.map((f) => (
        <button
          key={f.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(f)
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <span className="truncate font-semibold text-popover-foreground">{f.full_name || f.username}</span>
          <span className="truncate text-xs text-muted-foreground">@{f.username}</span>
        </button>
      ))}
    </div>
  )
}
