"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useInView } from "react-intersection-observer"
import { DiaryHeader, DiaryView } from "@/components/diary-header"
import { NewEntryComposer } from "@/components/new-entry-composer"
import { DiaryTimelineSidebar } from "@/components/diary-timeline-sidebar"
import { DiaryGrid } from "@/components/diary-grid"
import { DiaryForm } from "@/components/diary-form"
import { HashtagExplorer } from "@/components/hashtag-explorer"
import { FriendsExplorer } from "@/components/friends-explorer"
import { extractHashtags } from "@/lib/hashtags"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookDialogContent } from "@/components/book-dialog-content"
import { getEntries, getEntry, deleteEntry, Entry } from "@/services/api"
import { useAuth } from "@/context/auth-context"
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
  const router = useRouter()
  
  const [activeView, setActiveView] = useState<DiaryView>("home")
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { ref, inView } = useInView({ threshold: 0 })

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
      alert("Delete failed");
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
      alert("Couldn't load the entry for editing.")
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
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      <main className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          {/* Left: year/month timeline */}
          <DiaryTimelineSidebar entries={entries} />

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
            ) : (
              <>
                <div className="mb-10">
                  <p className="text-muted-foreground">Welcome back, <span className="text-primary font-medium">{user?.full_name}</span>. Here's your journey so far.</p>
                </div>

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
                        You've reached the end of your memories.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if(!open) setSelectedEntry(null)
      }}>
        <BookDialogContent className="sm:max-w-[960px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {selectedEntry ? "✨ Edit memory" : "New entry"}
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
            <AlertDialogTitle className="text-2xl font-bold text-foreground">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              This entry will be permanently removed from your timeline. Are you sure you want to delete it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              No, I changed my mind
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? "Deleting..." : "Yes, delete it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}