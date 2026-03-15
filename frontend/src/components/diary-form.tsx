"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createEntry, updateEntry, Entry } from "@/services/api"
import { Loader2, Film, Image as ImageIcon, X } from "lucide-react"

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null; 
}

export function DiaryForm({ onSuccess, initialData }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<{url: string, type: string}[]>([])
  const [existingMedia, setExistingMedia] = useState<string[]>(initialData?.images || [])

  // ดึงค่า URL จาก Env มาเก็บไว้ใช้ง่ายๆ
  const STORED_URL = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:8080";

  // ฟังก์ชันเช็คว่าเป็น Video หรือไม่
  const isVideo = (path: string) => {
    const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg'];
    return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
  };

  useEffect(() => {
    setExistingMedia(initialData?.images || [])
    setSelectedFiles([])
    setPreviews([])
  }, [initialData])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      const validFiles = filesArray.filter(file => file.size <= 50 * 1024 * 1024)
      if (validFiles.length !== filesArray.length) alert("บางไฟล์มีขนาดใหญ่เกิน 50MB")

      setSelectedFiles(prev => [...prev, ...validFiles])
      const newPreviews = validFiles.map(file => ({
        url: URL.createObjectURL(file),
        type: file.type
      }))
      setPreviews(prev => [...prev, ...newPreviews])
    }
  }

  const removeNewFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingMedia = (index: number) => {
    setExistingMedia(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      let finalPaths = [...existingMedia]

      if (selectedFiles.length > 0) {
        const mediaData = new FormData()
        selectedFiles.forEach(file => mediaData.append("media", file))

        const uploadRes = await fetch(`${STORED_URL}/upload`, {
          method: "POST",
          body: mediaData,
        })
        const { paths } = await uploadRes.json()
        finalPaths = [...finalPaths, ...paths]
      }

      const payload = {
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        created_by: "Watchara",
        images: finalPaths
      }

      if (initialData?.id) {
        // แก้ไขให้ส่ง payload ให้ครบตามที่ API ต้องการ
        await updateEntry(initialData.id, payload) 
      } else {
        await createEntry(payload)
      }

      onSuccess()
    } catch (err) {
      console.error(err)
      alert("เกิดข้อผิดพลาดในการบันทึก")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input 
        name="title" 
        placeholder="หัวข้อไดอารี่" 
        required 
        defaultValue={initialData?.title || ""} 
        className="text-lg font-medium" 
      />
      <Textarea 
        name="content" 
        placeholder="วันนี้เป็นอย่างไรบ้าง..." 
        required 
        defaultValue={initialData?.content || ""} 
        className="h-40" 
      />
      
      <div className="border-2 border-dashed rounded-xl p-6 bg-slate-50 text-center relative hover:bg-slate-100 transition-colors">
        <input 
          type="file" 
          multiple 
          accept="image/*,video/*" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <div className="flex gap-2">
            <ImageIcon size={24} />
            <Film size={24} />
          </div>
          <p className="text-sm">เพิ่มรูปภาพหรือวิดีโอใหม่</p>
        </div>
      </div>

      {/* ส่วนแสดง Media เดิมในระบบ */}
      {existingMedia.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">ไฟล์เดิมในระบบ:</p>
          <div className="grid grid-cols-4 gap-2">
            {existingMedia.map((path, i) => (
              <div key={`old-${i}`} className="relative aspect-square rounded-lg overflow-hidden border border-blue-200 bg-black/5">
                {isVideo(path) ? (
                  <video 
                    src={`${STORED_URL}${path}`} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <img 
                    src={`${STORED_URL}${path}`} 
                    className="w-full h-full object-cover" 
                    alt="old media" 
                  />
                )}
                <button 
                  type="button" 
                  onClick={() => removeExistingMedia(i)}
                  className="absolute top-1 right-1 bg-slate-800/80 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* รายการ Preview ไฟล์ใหม่ */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-blue-500">ไฟล์ที่เลือกใหม่:</p>
          <div className="grid grid-cols-4 gap-2">
            {previews.map((p, i) => (
              <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border-2 border-blue-400">
                {p.type.startsWith('video') ? (
                  <video src={p.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={p.url} className="w-full h-full object-cover" alt="new" />
                )}
                <button 
                  type="button"
                  onClick={() => removeNewFile(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : (initialData ? "อัปเดตข้อมูล" : "บันทึกข้อมูล")}
      </Button>
    </form>
  )
}