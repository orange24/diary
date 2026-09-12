"use client"

import { MentionTarget } from "@/lib/mentions"

interface MentionAutocompleteProps {
  query: string
  suggestions: MentionTarget[]
  position: { top: number; left: number }
  onSelect: (target: MentionTarget) => void
}

// Floating suggestion list anchored at the caret while typing "@" inside a
// scrapbook text box. onMouseDown (not onClick) + preventDefault stops the
// contentEditable from losing focus/blurring before the selection commits.
export function MentionAutocomplete({ query, suggestions, position, onSelect }: MentionAutocompleteProps) {
  const q = query.toLowerCase()
  const matches = suggestions
    .filter((s) => s.insertText.toLowerCase().includes(q) || s.displayName.toLowerCase().includes(q))
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
      {matches.map((s) => (
        <button
          key={s.key}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(s)
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
        >
          <span className="truncate font-semibold text-popover-foreground">{s.displayName}</span>
          <span className="truncate text-xs text-muted-foreground">
            @{s.insertText}
            {s.sublabel ? ` · ${s.sublabel}` : ""}
          </span>
        </button>
      ))}
    </div>
  )
}
