"use client"

import { useMemo } from "react"
import { Hash } from "lucide-react"
import { Entry } from "@/services/api"
import { extractHashtags } from "@/lib/hashtags"
import { DiaryGrid } from "@/components/diary-grid"
import { cn } from "@/lib/utils"

interface HashtagExplorerProps {
  entries: Entry[]
  isLoadingAll: boolean
  // Selection lives in the parent (not local state) so clicking a #tag
  // inside a card anywhere else in the app can jump straight here. Null
  // means "no explicit choice yet" — the most-recently-referenced tag is
  // shown below the cloud by default in that case.
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  currentUserId?: number
}

// Browsing surface for the "Hashtag" tab: a cloud of every #tag found across
// the loaded entries stays visible at all times, with the tagged entries for
// whichever tag is active shown below it in the same masonry card layout as
// the main feed. Tags are derived from entry text on the fly rather than
// stored, so there's no backend change needed to support this.
export function HashtagExplorer({
  entries,
  isLoadingAll,
  selectedTag,
  onSelectTag,
  onEdit,
  onDelete,
  currentUserId,
}: HashtagExplorerProps) {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entry of entries) {
      for (const tag of extractHashtags(entry)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [entries])

  // The tag attached to the single most recent entry that has any hashtag
  // at all — what "most recently referenced" defaults to before the user
  // has clicked anything.
  const mostRecentTag = useMemo(() => {
    let best: { tag: string; time: number } | null = null
    for (const entry of entries) {
      const time = new Date(entry.created_date).getTime()
      for (const tag of extractHashtags(entry)) {
        if (!best || time > best.time) best = { tag, time }
      }
    }
    return best?.tag ?? null
  }, [entries])

  const activeTag = selectedTag ?? mostRecentTag

  const taggedEntries = useMemo(() => {
    if (!activeTag) return []
    return entries
      .filter((entry) => extractHashtags(entry).includes(activeTag))
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
  }, [entries, activeTag])

  return (
    <div>
      <div className="mb-8 space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">All Hashtags</h2>
        <p className="text-sm text-muted-foreground">
          Type # followed by a category name in your entries, then browse by hashtag here.
        </p>
      </div>

      {tagCounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isLoadingAll ? "Loading all entries..." : "You don't have any hashtags in your entries yet"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tagCounts.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSelectTag(tag)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                tag === activeTag
                  ? "border-logo bg-logo text-logo-foreground"
                  : "border-border bg-card text-card-foreground hover:border-logo/40 hover:bg-logo/10 hover:text-logo"
              )}
            >
              <Hash className="size-3.5" />
              {tag}
              <span className={cn("text-xs font-normal", tag === activeTag ? "text-logo-foreground/80" : "text-muted-foreground")}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {isLoadingAll && tagCounts.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">Loading more older entries...</p>
      )}

      {activeTag && (
        <div className="mt-8">
          <div className="mb-6 flex items-center gap-2">
            <Hash className="size-6 text-logo" />
            <h3 className="text-2xl font-bold tracking-tight text-foreground">{activeTag}</h3>
            <span className="text-sm font-medium text-muted-foreground">({taggedEntries.length})</span>
          </div>

          {taggedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries found with this hashtag</p>
          ) : (
            <DiaryGrid
              entries={taggedEntries}
              currentUserId={currentUserId}
              onEdit={onEdit}
              onDelete={onDelete}
              onHashtagClick={onSelectTag}
            />
          )}
        </div>
      )}
    </div>
  )
}
