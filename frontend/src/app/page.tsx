"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useInView } from "react-intersection-observer"
import { DiaryHeader } from "@/components/diary-header"
import { DiaryGrid } from "@/components/diary-grid"
import { DiaryForm } from "@/components/diary-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getEntries, getEntry, deleteEntry, Entry } from "@/services/api"
import { getWeeklyTheme } from "@/lib/theme-utils"
import { useAuth } from "@/context/auth-context" // ✅ นำเข้าเฉยๆ อย่าเพิ่งเรียกใช้ข้างนอก
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
  // ✅ เรียกใช้ Hook ภายใน Component Body เท่านั้น
  const { token, handleLogout, user, isLoading } = useAuth()
  const { setTheme } = useTheme()
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
    // รอให้ isLoading เป็น false ก่อนค่อยเช็ค token
    if (!isLoading && !token) {
       router.push("/login")
    }
  }, [token, isLoading, router])
  

  const loadMoreEntries = async (reset = false) => {
    // ถ้าไม่มี Token หรือกำลังโหลดอยู่ ให้หยุดทำงาน
    if (!token || loading) return 
    if (!reset && !hasMore) return
    
    setLoading(true)
    try {
      const currentPage = reset ? 1 : page
      const newEntries = await getEntries(currentPage, 10, token)
      
      if (newEntries.length < 10) setHasMore(false)
      
      setEntries((prev) => reset ? newEntries : [...prev, ...newEntries])
      setPage(currentPage + 1)
    } catch (error) {
      console.error("Load error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Infinite Scroll
  useEffect(() => {
    if (inView && hasMore && token) {
      loadMoreEntries()
    }
  }, [inView, hasMore, token])

  // Weekly Theme
  useEffect(() => {
    const localTheme = localStorage.getItem('theme')
    if (!localTheme) {
      setTheme(getWeeklyTheme())
    }
  }, [setTheme])

  const handleSuccess = () => {
    setIsModalOpen(false)
    setSelectedEntry(null)
    setHasMore(true)      
    loadMoreEntries(true)  
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

  // 🛡️ ป้องกันหน้ากระพริบ: ถ้ากำลังโหลดสถานะ Auth หรือไม่มี Token ไม่ต้อง Render อะไร
  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
        userName={user?.full_name} // ✅ ส่งชื่อไปโชว์ที่ Header ได้เลย
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Memory of the Week</h2>
          <p className="text-muted-foreground italic">Welcome back, {user?.full_name}</p>
        </div>
        
        <DiaryGrid 
          entries={entries} 
          onEdit={handleEdit} 
          onDelete={(id) => setDeleteId(id)} 
        />
        
        <div ref={ref} className="py-10 text-center flex justify-center">
          {loading && (
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            </div>
          )}
          {!hasMore && entries.length > 0 && (
            <p className="text-muted-foreground text-sm italic border-t pt-8 mt-4 w-full">
              ✨ You've reached the end of your journey. ✨
            </p>
          )}
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if(!open) setSelectedEntry(null)
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-2xl border-primary/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {selectedEntry ? "แก้ไขบันทึก" : "เขียนบันทึกใหม่"}
            </DialogTitle>
          </DialogHeader>
          <DiaryForm onSuccess={handleSuccess} initialData={selectedEntry} token={token} userId={user?.userId} />
        </DialogContent>
      </Dialog>

      <AlertDialog 
        open={deleteId !== null} 
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent className="rounded-2xl border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">ลบบันทึกนี้ใช่ไหม?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบนี้จะไม่สามารถย้อนคืนได้ ข้อมูลจะหายไปจากระบบของคุณเลยนะ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-none bg-secondary hover:bg-secondary/80">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-xl bg-destructive hover:bg-destructive/90 text-white"
            >
              {isDeleting ? "กำลังลบ..." : "ใช่, ลบเลย"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}