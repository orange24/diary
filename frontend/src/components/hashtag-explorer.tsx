"use client"

import { useMemo } from "react"
import { ArrowLeft, Hash } from "lucide-react"
import { Entry } from "@/services/api"
import { extractHashtags } from "@/lib/hashtags"
import { DiaryGrid } from "@/components/diary-grid"

interface HashtagExplorerProps {
  entries: Entry[]
  isLoadingAll: boolean
  // Selection lives in the parent (not local state) so clicking a #tag
  // inside a card anywhere else in the app can jump straight here.
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  currentUserId?: number
}

// Browsing surface for the "Hashtag" tab: a cloud of every #tag found across
// the loaded entries, and — once one is picked — just the entries carrying
// it, newest first. Tags are derived from entry text on the fly rather than
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

  const taggedEntries = useMemo(() => {
    if (!selectedTag) return []
    return entries
      .filter((entry) => extractHashtags(entry).includes(selectedTag))
      .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
  }, [entries, selectedTag])

  if (selectedTag) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onSelectTag(null)}
          className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-logo"
        >
          <ArrowLeft className="size-4" /> แฮชแท็กทั้งหมด
        </button>

        <div className="mb-8 flex items-center gap-2">
          <Hash className="size-6 text-logo" />
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{selectedTag}</h2>
          <span className="text-sm font-medium text-muted-foreground">({taggedEntries.length})</span>
        </div>

        {taggedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่พบบันทึกที่ติดแฮชแท็กนี้</p>
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
    )
  }

  return (
    <div>
      <div className="mb-8 space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">แฮชแท็กทั้งหมด</h2>
        <p className="text-sm text-muted-foreground">
          พิมพ์ # ตามด้วยชื่อหมวดในบันทึก แล้วเลือกดูตามแฮชแท็กได้ที่นี่
        </p>
      </div>

      {tagCounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isLoadingAll ? "กำลังโหลดบันทึกทั้งหมด..." : "ยังไม่มีแฮชแท็กในบันทึกของคุณ"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tagCounts.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => onSelectTag(tag)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-card-foreground shadow-sm transition-all hover:border-logo/40 hover:bg-logo/10 hover:text-logo"
            >
              <Hash className="size-3.5" />
              {tag}
              <span className="text-xs font-normal text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      )}

      {isLoadingAll && tagCounts.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">กำลังโหลดบันทึกเก่าเพิ่มเติม...</p>
      )}
    </div>
  )
}
