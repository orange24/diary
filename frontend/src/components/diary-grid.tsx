"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react"
import { Entry } from "@/services/api"

interface DiaryGridProps {
  entries: Entry[]
  onEdit?: (id: number) => void 
  onDelete?: (id: number) => void
}

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:8080";
const isVideo = (path: string) => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
};

const getDisplayMedia = (path: string) => {
  const videoExtensions = ['.mp4', '.mov', '.webm'];
  const ext = path.split('.').pop()?.toLowerCase();
  
  if (videoExtensions.includes(`.${ext}`)) {
    // ถ้าเป็นวิดีโอ ให้เรียกรูป thumb- นำหน้า (ที่เราทำไว้ใน Go)
    const fileName = path.split('/').pop();
    return `${IMAGE_BASE_URL}/uploads/thumb-${fileName}.jpg`;
  }
  return `${IMAGE_BASE_URL}${path}`;
};

export function DiaryGrid({ entries, onEdit, onDelete }: DiaryGridProps) {
  // --- State สำหรับ Lightbox ---
  const [isOpen, setIsOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (images: string[], index: number) => {
    setCurrentImages(images)
    setCurrentIndex(index)
    setIsOpen(true)
  }

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % currentImages.length)
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length)

  return (
    <div className="grid grid-cols-1 gap-6">
      {entries.map((entry) => (
        <Card key={entry.id} className="flex flex-col bg-white overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold">{entry.title}</CardTitle>
            <div className="flex justify-between text-xs text-gray-400">
              <span>By {entry.created_by || 'Anonymous'}</span>
              <span>{entry.created_date ? new Date(entry.created_date).toLocaleDateString() : ''}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {entry.content}
            </p>
            
            
            {entry.images && entry.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {entry.images.map((path, index) => (
                  <div 
                    key={index} 
                    className="relative flex-none w-64 h-48 rounded-xl overflow-hidden border cursor-pointer"
                    onClick={() => openLightbox(entry.images, index)}
                  >
                    <img
                      src={getDisplayMedia(path)}
                      className="w-full h-full object-cover"
                      alt="Media"
                    />
                    {/* ถ้าเป็นวิดีโอ ให้แปะไอคอน Play ทับไว้ให้ User รู้ */}
                    {isVideo(path) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <PlayCircle className="text-white w-12 h-12 opacity-80" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2 pt-2 pb-4 px-6">
            <Button variant="ghost" size="sm" onClick={() => onEdit?.(entry.id)} className="text-blue-600 hover:bg-blue-50">
              <Pencil className="h-4 w-4 mr-1" /> แก้ไข
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete?.(entry.id)} className="text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-1" /> ลบ
            </Button>
          </CardFooter>
        </Card>
      ))}

      {/* --- Lightbox UI (Full Screen Overlay) --- */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
          {/* ปุ่มปิด */}
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-6 right-6 text-white hover:text-gray-300 z-[110]"
          >
            <X className="h-8 w-8" />
          </button>

          {/* ปุ่มย้อนกลับ */}
          {currentImages.length > 1 && (
            <button 
              onClick={prevImage}
              className="absolute left-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}

          {/* รูปภาพใหญ่ */}
         <div className="max-w-5xl max-h-[85vh] flex items-center justify-center">
            {isVideo(currentImages[currentIndex]) ? (
              <video 
                src={`${IMAGE_BASE_URL}${currentImages[currentIndex]}`}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded"
              />
            ) : (
              <img
                src={`${IMAGE_BASE_URL}${currentImages[currentIndex]}`}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* ปุ่มถัดไป */}
          {currentImages.length > 1 && (
            <button 
              onClick={nextImage}
              className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}