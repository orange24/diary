"use client"

import { useEffect } from "react"
import { useInView } from "react-intersection-observer"
import { NewEntryComposer } from "@/components/new-entry-composer"
import { DiaryGrid } from "@/components/diary-grid"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, Rows3 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useLocale } from "@/context/locale-context"
import { useDashboard } from "@/context/dashboard-context"

export default function HomePage() {
  const { token, user } = useAuth()
  const { t } = useLocale()
  const {
    entries,
    hasMore,
    loading,
    loadMoreEntries,
    feedLayout,
    setFeedLayout,
    handleEdit,
    requestDelete,
    openHashtag,
    openNewEntry,
    contentStartRef,
  } = useDashboard()

  const { ref, inView } = useInView({ threshold: 0 })

  useEffect(() => {
    if (inView && hasMore && token && !loading) {
      loadMoreEntries()
    }
  }, [inView, hasMore, token, loading, loadMoreEntries])

  return (
    // Single-column mode caps and centers the lane so it reads at a normal
    // feed width instead of stretching across whatever space the grid
    // column leaves; full-width grid mode keeps using all of it.
    <div className={feedLayout === "single" ? "mx-auto w-full max-w-2xl" : ""}>
      <div className="mb-10">
        <p className="text-muted-foreground">
          {t("dashboard.welcomeBefore")}
          <span className="text-primary font-medium">{user?.full_name}</span>
          {t("dashboard.welcomeAfter")}
        </p>
      </div>

      <div className="mb-3 flex justify-end">
        <ToggleGroup
          type="single"
          variant="outline"
          value={feedLayout}
          onValueChange={(value) => value && setFeedLayout(value as "grid" | "single")}
        >
          <ToggleGroupItem value="grid" aria-label={t("dashboard.masonryLayout")} title={t("dashboard.masonryLayout")}>
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="single"
            aria-label={t("dashboard.singleColumnLayout")}
            title={t("dashboard.singleColumnLayout")}
          >
            <Rows3 className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div ref={contentStartRef} />
      <NewEntryComposer onNewEntry={openNewEntry} userName={user?.full_name} />

      <DiaryGrid
        entries={entries}
        currentUserId={user?.userId}
        onEdit={handleEdit}
        onDelete={requestDelete}
        onHashtagClick={openHashtag}
        layout={feedLayout}
      />

      <div ref={ref} className="py-16 text-center flex flex-col items-center justify-center">
        {loading && (
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          </div>
        )}
        {!hasMore && entries.length > 0 && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="h-px w-24 bg-border" />
            <p className="text-muted-foreground text-sm font-medium italic">{t("dashboard.endOfMemories")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
