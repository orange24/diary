"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useInView } from "react-intersection-observer"
import { DiaryHeader } from "@/components/diary-header"
import { DiaryGrid } from "@/components/diary-grid"
import { DiaryForm } from "@/components/diary-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
      alert("ลบไม่สำเร็จ");
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
      alert("ไม่สามารถดึงข้อมูลเพื่อแก้ไขได้")
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
        onNewEntry={() => {
          setSelectedEntry(null);
          setIsModalOpen(true);
        }} 
        onLogout={handleLogout}
        userName={user?.full_name}
      />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-10 space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground">Memory Lane</h2>
          <p className="text-muted-foreground">Welcome back, <span className="text-primary font-medium">{user?.full_name}</span>. Here's your journey so far.</p>
        </div>
        
        <DiaryGrid 
          entries={entries} 
          onEdit={handleEdit} 
          onDelete={(id) => setDeleteId(id)} 
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
      </main>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if(!open) setSelectedEntry(null)
      }}>
        <DialogContent className="sm:max-w-[960px] max-h-[95vh] overflow-y-auto rounded-3xl border-primary/10 shadow-2xl p-0">
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {selectedEntry ? "✨ แก้ไขบันทึกความทรงจำ" : "✍️ บันทึกเรื่องราวใหม่"}
              </DialogTitle>
            </DialogHeader>
            <DiaryForm onSuccess={handleSuccess} initialData={selectedEntry} token={token} userId={user?.userId} />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={deleteId !== null} 
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-3xl border-primary/10 p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">ยืนยันการลบข้อมูล?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              บันทึกนี้จะหายไปจากไทม์ไลน์ของคุณอย่างถาวร คุณแน่ใจใช่ไหมว่าจะลบเรื่องราวนี้?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              ไม่ใช่, ฉันเปลี่ยนใจ
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? "กำลังลบ..." : "ใช่, ลบเลย"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}