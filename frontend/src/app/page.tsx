"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { getWeeklyTheme } from "@/lib/theme-utils"
import { useInView } from "react-intersection-observer"
import { DiaryHeader } from "@/components/diary-header"
import { DiaryGrid } from "@/components/diary-grid"
import { getEntries, getEntry, deleteEntry, Entry } from "@/services/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DiaryForm } from "@/components/diary-form"
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
  const { setTheme } = useTheme()
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // State สำหรับการลบ
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { ref, inView } = useInView({ threshold: 0 })

  const loadMoreEntries = async (reset = false) => {
    if (loading || (!hasMore && !reset)) return
    setLoading(true)
    try {
      const currentPage = reset ? 1 : page
      const newEntries = await getEntries(currentPage, 10) 
      
      if (newEntries.length < 10) setHasMore(false)
      
      setEntries((prev) => reset ? newEntries : [...prev, ...newEntries])
      setPage(currentPage + 1)
    } catch (error) {
      console.error("Load error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (inView && hasMore) loadMoreEntries()
  }, [inView, hasMore])

  useEffect(() => {
    const weeklyTheme = getWeeklyTheme()
    setTheme(weeklyTheme)
  }, [setTheme])

  const handleSuccess = () => {
    setIsModalOpen(false)
    setSelectedEntry(null)
    setHasMore(true)      
    loadMoreEntries(true)  
  }

  // ฟังก์ชันกดยืนยันการลบจาก Modal
  const confirmDelete = async () => {
    if (deleteId === null) return;
    
    setIsDeleting(true);
    try {
      await deleteEntry(deleteId);
      setEntries((prev) => prev.filter((e) => e.id !== deleteId));
      setDeleteId(null); 
    } catch (error) {
      alert("ลบไม่สำเร็จ");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const entry = await getEntry(id)
      setSelectedEntry(entry)
      setIsModalOpen(true)
    } catch (error) {
      alert("ไม่สามารถดึงข้อมูลเพื่อแก้ไขได้")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DiaryHeader onNewEntry={() => {
        setSelectedEntry(null);
        setIsModalOpen(true);
      }} />

      <main className="container mx-auto px-4 py-8">
        <DiaryGrid 
          entries={entries} 
          onEdit={handleEdit} 
          // เมื่อกดถังขยะ ให้เซ็ต ID ที่จะลบเพื่อเปิด AlertDialog
          onDelete={(id) => setDeleteId(id)} 
        />
        
        <div ref={ref} className="py-10 text-center flex justify-center">
          {loading && (
            <div className="flex gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            </div>
          )}
          {!hasMore && entries.length > 0 && (
            <p className="text-gray-400 text-sm italic">✨ หมดแล้วจ้า ✨</p>
          )}
        </div>
      </main>

      {/* Modal สำหรับ Create / Edit */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open)
        if(!open) setSelectedEntry(null)
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedEntry ? "แก้ไขบันทึก" : "เขียนบันทึกใหม่"}
            </DialogTitle>
          </DialogHeader>
          <DiaryForm onSuccess={handleSuccess} initialData={selectedEntry} />
        </DialogContent>
      </Dialog>

      {/* AlertDialog สำหรับการลบที่สวยงาม */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">ลบบันทึกนี้ใช่ไหม?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบนี้จะไม่สามารถย้อนคืนได้ รูปภาพและวิดีโอที่เกี่ยวข้องจะหายไปด้วยนะ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-none bg-slate-100 hover:bg-slate-200">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-xl bg-red-500 hover:bg-red-600 transition-colors"
            >
              {isDeleting ? "กำลังลบ..." : "ใช่, ลบเลย"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}