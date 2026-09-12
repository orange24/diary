"use client"

import { useCallback, useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { DiaryGrid } from "@/components/diary-grid"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, Rows3 } from "lucide-react"
import { getNosyFeed, Entry } from "@/services/api"
import { useAuth } from "@/context/auth-context"
import { useLocale } from "@/context/locale-context"
import { useDashboard } from "@/context/dashboard-context"

export default function NosyPage() {
  const { token, user } = useAuth()
  const { t } = useLocale()
  const { openHashtag } = useDashboard()

  // Fully independent of the shared dashboard entries — never mixed with
  // the home feed's own list.
  const [nosyEntries, setNosyEntries] = useState<Entry[]>([])
  const [nosyPage, setNosyPage] = useState(1)
  const [nosyHasMore, setNosyHasMore] = useState(true)
  const [nosyLoading, setNosyLoading] = useState(false)
  // Defaults to "grid" (masonry), unlike the home feed's "single" default,
  // since this is a browse-y feed of other people's public entries rather
  // than your own running diary.
  const [nosyFeedLayout, setNosyFeedLayout] = useState<"grid" | "single">("grid")
  const { ref: nosyRef, inView: nosyInView } = useInView({ threshold: 0 })

  const loadMoreNosyEntries = useCallback(async () => {
    if (!token || nosyLoading || !nosyHasMore) return
    setNosyLoading(true)
    try {
      const response = await getNosyFeed(nosyPage, 10, token)
      if (response.length < 10) setNosyHasMore(false)
      setNosyEntries((prev) => [...prev, ...response])
      setNosyPage((p) => p + 1)
    } catch (error) {
      console.error("Nosy feed load error:", error)
    } finally {
      setNosyLoading(false)
    }
  }, [token, nosyPage, nosyHasMore, nosyLoading])

  useEffect(() => {
    if (nosyInView && nosyHasMore && token && !nosyLoading) {
      loadMoreNosyEntries()
    }
  }, [nosyInView, nosyHasMore, token, nosyLoading, loadMoreNosyEntries])

  return (
    <div className={nosyFeedLayout === "single" ? "mx-auto w-full max-w-2xl" : ""}>
      <div className="mb-10">
        <p className="text-muted-foreground">{t("dashboard.nosyIntro")}</p>
      </div>

      <div className="mb-3 flex justify-end">
        <ToggleGroup
          type="single"
          variant="outline"
          value={nosyFeedLayout}
          onValueChange={(value) => value && setNosyFeedLayout(value as "grid" | "single")}
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

      {nosyEntries.length === 0 && !nosyHasMore ? (
        <p className="py-16 text-center text-muted-foreground">{t("dashboard.nosyEmpty")}</p>
      ) : (
        <DiaryGrid
          entries={nosyEntries}
          currentUserId={user?.userId}
          onHashtagClick={openHashtag}
          layout={nosyFeedLayout}
          hideAudienceBadge
          rowAligned
        />
      )}

      <div ref={nosyRef} className="py-16 text-center flex flex-col items-center justify-center">
        {nosyLoading && (
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-3 h-3 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          </div>
        )}
        {!nosyHasMore && nosyEntries.length > 0 && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="h-px w-24 bg-border" />
            <p className="text-muted-foreground text-sm font-medium italic">{t("dashboard.endOfMemories")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
