"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useInView } from "react-intersection-observer"
import { DiaryHeader, DiaryView } from "@/components/diary-header"
import { NewEntryComposer } from "@/components/new-entry-composer"
import { DiaryTimelineSidebar } from "@/components/diary-timeline-sidebar"
import { DiaryGrid } from "@/components/diary-grid"
import { DiaryForm } from "@/components/diary-form"
import { HashtagExplorer } from "@/components/hashtag-explorer"
import { FriendsExplorer } from "@/components/friends-explorer"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, Rows3 } from "lucide-react"
import { extractHashtags } from "@/lib/hashtags"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookDialogContent } from "@/components/book-dialog-content"
import { getEntries, getEntry, deleteEntry, getNosyFeed, Entry } from "@/services/api"
import { useAuth } from "@/context/auth-context"
import { useLocale } from "@/context/locale-context"
import { toast } from "sonner"
import { translateError } from "@/lib/i18n"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function DiaryDashboard() {
  const { token, handleLogout, user, isLoading } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  
  const [activeView, setActiveView] = useState<DiaryView>("home")
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [feedLayout, setFeedLayout] = useState<"grid" | "single">("single")
  // Single-column mode reserves a real right lane (for content added
  // later); full-width grid mode instead docks a collapsed bar to the
  // screen edge. Only relevant on the home feed — hashtags/friends don't
  // have a layout toggle.
  const showRightLane = activeView === "home" && feedLayout === "single"
  const showRightBar = activeView === "home" && feedLayout === "grid"

  // The timeline sidebar's top should line up with where the actual content
  // (composer + feed) starts, not with the "Welcome back" greeting/toggle
  // row above it — measured live since the greeting's height varies with
  // the user's name and viewport width.
  const gridTopRef = useRef<HTMLDivElement>(null)
  const contentStartRef = useRef<HTMLDivElement>(null)
  const [timelineTopOffset, setTimelineTopOffset] = useState(0)

  useEffect(() => {
    const gridEl = gridTopRef.current
    const contentEl = contentStartRef.current
    if (!gridEl || !contentEl) {
      setTimelineTopOffset(0)
      return
    }
    const measure = () => {
      setTimelineTopOffset(contentEl.getBoundingClientRect().top - gridEl.getBoundingClientRect().top)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(gridEl)
    observer.observe(contentEl)
    return () => observer.disconnect()
  }, [activeView, feedLayout, user?.full_name])
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { ref, inView } = useInView({ threshold: 0 })

  // Nosy mode: other users' public entries, its own separate feed/pagination
  // state since it's never mixed with the home feed's `entries`.
  const [nosyEntries, setNosyEntries] = useState<Entry[]>([])
  const [nosyPage, setNosyPage] = useState(1)
  const [nosyHasMore, setNosyHasMore] = useState(true)
  const [nosyLoading, setNosyLoading] = useState(false)
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

  // --- 1. Security Check ---
  useEffect(() => {
    if (!isLoading && !token) {
       router.push("/login")
    }
  }, [token, isLoading, router])

  // ✅ ใช้ useCallback เพื่อให้ฟังก์ชันไม่ถูกสร้างใหม่บ่อยเกินไป
  const loadMoreEntries = useCallback(async (reset = false) => {
    if (!token || loading) return 
    if (!reset && !hasMore) return
    
    setLoading(true)
    try {
      const currentPage = reset ? 1 : (reset ? 1 : page)
      const response = await getEntries(currentPage, 10, token)
      
      // ✅ กรองข้อมูลให้เป็น Array เสมอ ป้องกันพังจาก Backend
      const newEntries = Array.isArray(response) ? response : []
      
      if (newEntries.length < 10) setHasMore(false)
      else setHasMore(true)

      setEntries((prev) => {
        const currentPrev = Array.isArray(prev) ? prev : []
        return reset ? newEntries : [...currentPrev, ...newEntries]
      });

      setPage(reset ? 2 : page + 1)
    } catch (error: any) {
      console.error("Load error:", error)
      if (error?.status === 401) router.push("/login")
      if (reset) setEntries([]) 
    } finally {
      setLoading(false)
    }
  }, [token, page, hasMore, loading, router])

  // Infinite Scroll
  useEffect(() => {
    if (inView && hasMore && token && !loading) {
      loadMoreEntries()
    }
  }, [inView, hasMore, token, loading, loadMoreEntries])

  // The Hashtag tab has no scroll sentinel to trigger pagination, but it
  // needs every entry loaded to build an accurate tag list — so keep
  // fetching pages in the background for as long as that tab is open.
  useEffect(() => {
    if (activeView === "hashtags" && hasMore && token && !loading) {
      loadMoreEntries()
    }
  }, [activeView, hasMore, token, loading, loadMoreEntries])

  // Switching tabs via the nav always starts from the tag cloud; clicking a
  // #tag inside a card (openHashtag) jumps straight past it instead.
  const handleViewChange = (view: DiaryView) => {
    setActiveView(view)
    setSelectedHashtag(null)
  }

  const openHashtag = (tag: string) => {
    setSelectedHashtag(tag)
    setActiveView("hashtags")
  }

  // Suggestions for the "#" autocomplete in the entry editor — drawn from
  // whatever's already loaded, same trade-off as the Hashtag tab's tag cloud.
  const existingHashtags = useMemo(() => {
    const tags = new Set<string>()
    for (const entry of entries) {
      for (const tag of extractHashtags(entry)) tags.add(tag)
    }
    return Array.from(tags)
  }, [entries])

  const handleSuccess = () => {
    setIsModalOpen(false)
    setSelectedEntry(null)
    setPage(1)
    setHasMore(true)      
    loadMoreEntries(true) // โหลดหน้า 1 ใหม่แบบล้างไพ่
  }

  const confirmDelete = async () => {
    if (deleteId === null || !token) return;
    setIsDeleting(true);
    try {
      await deleteEntry(deleteId, token);
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
      setDeleteId(null);
    } catch (error) {
      toast.error(translateError(error, t) || t("dashboard.deleteFailedAlert"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async (id: number) => {
    if (!token) return
    try {
      const entry = await getEntry(id, token)
      setSelectedEntry(entry)
      setIsModalOpen(true)
    } catch (error) {
      toast.error(translateError(error, t) || t("dashboard.editEntryLoadFailedAlert"))
    }
  }

  if (isLoading || (!token && typeof window !== 'undefined')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-1000">
      <DiaryHeader
        onLogout={handleLogout}
        userName={user?.full_name}
        userAvatar={user?.profile_picture}
        userSlug={user?.slug}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      <main
        className={`mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 ${showRightBar ? "lg:pr-20" : ""}`}
      >
        <div
          ref={gridTopRef}
          className={`grid grid-cols-1 gap-8 ${
            showRightLane ? "lg:grid-cols-[200px_minmax(0,1fr)_280px]" : "lg:grid-cols-[200px_minmax(0,1fr)]"
          }`}
        >
          {/* Left: year/month timeline */}
          <DiaryTimelineSidebar entries={entries} topOffset={timelineTopOffset} />

          {/* Center: the feed, or the hashtag browser */}
          <div className="min-w-0">
            {activeView === "hashtags" ? (
              <HashtagExplorer
                entries={entries}
                isLoadingAll={hasMore || loading}
                selectedTag={selectedHashtag}
                onSelectTag={setSelectedHashtag}
                onEdit={handleEdit}
                onDelete={(id) => setDeleteId(id)}
                currentUserId={user?.userId}
              />
            ) : activeView === "friends" ? (
              <FriendsExplorer token={token} />
            ) : activeView === "nosy" ? (
              <div className={feedLayout === "single" ? "mx-auto w-full max-w-2xl" : ""}>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-muted-foreground">{t("dashboard.nosyIntro")}</p>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={feedLayout}
                    onValueChange={(value) => value && setFeedLayout(value as "grid" | "single")}
                  >
                    <ToggleGroupItem value="grid" aria-label={t("dashboard.masonryLayout")} title={t("dashboard.masonryLayout")}>
                      <LayoutGrid className="size-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="single" aria-label={t("dashboard.singleColumnLayout")} title={t("dashboard.singleColumnLayout")}>
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
                    layout={feedLayout}
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
                      <p className="text-muted-foreground text-sm font-medium italic">
                        {t("dashboard.endOfMemories")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Single-column mode caps and centers the lane so it reads at
              // a normal feed width instead of stretching across whatever
              // space the grid column leaves; full-width grid mode keeps
              // using all of it.
              <div className={feedLayout === "single" ? "mx-auto w-full max-w-2xl" : ""}>
                <div className="mb-10">
                  <p className="text-muted-foreground">{t("dashboard.welcomeBefore")}<span className="text-primary font-medium">{user?.full_name}</span>{t("dashboard.welcomeAfter")}</p>
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
                    <ToggleGroupItem value="single" aria-label={t("dashboard.singleColumnLayout")} title={t("dashboard.singleColumnLayout")}>
                      <Rows3 className="size-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div ref={contentStartRef} />
                <NewEntryComposer
                  onNewEntry={() => {
                    setSelectedEntry(null);
                    setIsModalOpen(true);
                  }}
                  userName={user?.full_name}
                />

                <DiaryGrid
                  entries={entries}
                  currentUserId={user?.userId}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeleteId(id)}
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
                      <p className="text-muted-foreground text-sm font-medium italic">
                        {t("dashboard.endOfMemories")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right lane: reserved for future content when the feed is
              capped to a single reading-width column instead of spreading
              full-width — empty skeleton for now. */}
          {showRightLane && (
            <div className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("dashboard.comingSoon")}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Collapsed right rail: what the right lane above becomes once the
          feed spreads full-width again — a thin bar docked to the edge
          instead of taking layout space. Empty skeleton for now. */}
      {showRightBar && (
        <div className="fixed top-16 right-0 bottom-0 z-30 hidden w-14 border-l border-border bg-card/80 backdrop-blur-sm lg:block" />
      )}

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if(!open) setSelectedEntry(null)
      }}>
        <BookDialogContent className="sm:max-w-[960px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {selectedEntry ? t("dashboard.editMemoryTitle") : t("dashboard.newEntryTitle")}
            </DialogTitle>
          </DialogHeader>
          <DiaryForm
            key={selectedEntry?.id ?? "new"}
            onSuccess={handleSuccess}
            initialData={selectedEntry}
            token={token}
            userId={user?.userId}
            userName={user?.full_name}
            existingHashtags={existingHashtags}
          />
        </BookDialogContent>
      </Dialog>

      <AlertDialog 
        open={deleteId !== null} 
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-3xl border-primary/10 p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">{t("dashboard.deleteEntryTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              {t("dashboard.deleteEntryDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              {t("dashboard.deleteEntryCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? t("dashboard.deleteEntryDeleting") : t("dashboard.deleteEntryConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}