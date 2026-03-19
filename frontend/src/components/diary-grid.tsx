"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react"
import { Entry } from "@/services/api"

interface DiaryGridProps {
  entries: Entry[]
  onEdit?: (id: number) => void 
  onDelete?: (id: number) => void
}

const isVideo = (path: string) => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
};

const getDisplayMedia = (path: string) => {
  if (!path) return "";
  
  // 1. กรณีไฟล์จาก Cloudinary (ขึ้นต้นด้วย http)
  if (path.startsWith('http')) {
    if (isVideo(path)) {
      // ใช้ Cloudinary transformation (so_auto) เพื่อหาเฟรมวิดีโอมาเป็นรูปภาพ
      return path.replace(/\/upload\//, "/upload/so_auto/").replace(/\.[^/.]+$/, ".jpg");
    }
    return path;
  }
  
  // 2. กรณีไฟล์เดิมในเครื่อง (Local Storage)
  const baseUrl = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:9090";
  const fullPath = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

  if (isVideo(path)) {
    // ดึงชื่อไฟล์ออกมาเพื่อหาไฟล์ Thumbnail ที่คุณเคยทำไว้ใน Go (thumb-xxx.jpg)
    const fileName = path.split('/').pop();
    // สมมติว่าไฟล์เก็บอยู่ในโฟลเดอร์ uploads/ เหมือนเดิม
    return `${baseUrl}/uploads/thumb-${fileName}.jpg`;
  }

  return fullPath;
};

export function DiaryGrid({ entries, onEdit, onDelete }: DiaryGridProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (images: string[], index: number) => {
    setCurrentImages(images)
    setCurrentIndex(index)
    setIsOpen(true)
  }

  const closeLightbox = useCallback(() => setIsOpen(false), [])

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % currentImages.length)
  }, [currentImages.length])

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length)
  }, [currentImages.length])

  // --- ⌨️ Keyboard Navigation Logic ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case "ArrowRight":
          nextImage()
          break
        case "ArrowLeft":
          prevImage()
          break
        case "Escape":
          closeLightbox()
          break
      }
    }

    // ลงทะเบียน Event
    window.addEventListener("keydown", handleKeyDown)
    
    // ป้องกันการ Scroll หน้าเว็บบรรยากาศข้างหลังเมื่อเปิดรูปใหญ่
    if (isOpen) document.body.style.overflow = "hidden"
    
    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, nextImage, prevImage, closeLightbox])

  return (
    <div className="grid grid-cols-1 gap-6">
      {entries.map((entry) => (
        <Card key={entry.id} className="group flex flex-col bg-white overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-slate-800">{entry.title}</CardTitle>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              <span>By {entry.created_by || 'Anonymous'}</span>
              <span>{entry.created_date ? new Date(entry.created_date).toLocaleDateString() : ''}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {entry.content}
            </p>
            
            {entry.images && entry.images.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {entry.images.map((path, index) => (
                  <div 
                    key={index} 
                    className="relative flex-none w-72 h-48 rounded-2xl overflow-hidden border border-slate-100 cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-primary hover:z-20 m-[2px]"
                    onClick={() => openLightbox(entry.images, index)}
                  >
                    <img
                      src={getDisplayMedia(path)}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                      alt="Media thumbnail"
                      loading="lazy"
                    />
                    {isVideo(path) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                        <PlayCircle className="text-white w-12 h-12 opacity-90 drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2 pt-2 pb-4 px-6 border-t border-slate-50">
            <Button variant="ghost" size="sm" onClick={() => onEdit?.(entry.id)} className="text-blue-600 hover:bg-blue-50 rounded-lg">
              <Pencil className="h-4 w-4 mr-1.5" /> แก้ไข
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete?.(entry.id)} className="text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 className="h-4 w-4 mr-1.5" /> ลบ
            </Button>
          </CardFooter>
        </Card>
      ))}

      {/* --- Lightbox UI --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300"
          onClick={closeLightbox} // คลิกพื้นที่ว่างเพื่อปิด
        >
          <button 
            onClick={closeLightbox}
            className="absolute top-8 right-8 text-white/70 hover:text-white z-[110] transition-colors"
          >
            <X className="h-10 w-10" />
            <span className="text-[10px] block text-center mt-1">ESC</span>
          </button>

          {currentImages.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-6 text-white p-3 hover:bg-white/10 rounded-full transition-all group"
            >
              <ChevronLeft className="h-12 w-12 group-active:scale-90" />
            </button>
          )}

          <div 
            className="relative max-w-6xl max-h-[85vh] flex items-center justify-center select-none"
            onClick={(e) => e.stopPropagation()} // ป้องกันการคลิกรูปแล้วปิด
          >
            {isVideo(currentImages[currentIndex]) ? (
              <video 
                src={currentImages[currentIndex].startsWith('http') 
                    ? currentImages[currentIndex] 
                    : `${process.env.NEXT_PUBLIC_STORED_URL}${currentImages[currentIndex]}`}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={getDisplayMedia(currentImages[currentIndex])}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                alt="Full size"
              />
            )}
            
            {/* ตัวเลขบอกลำดับรูป */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono">
              {currentIndex + 1} / {currentImages.length}
            </div>
          </div>

          {currentImages.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-6 text-white p-3 hover:bg-white/10 rounded-full transition-all group"
            >
              <ChevronRight className="h-12 w-12 group-active:scale-90" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}