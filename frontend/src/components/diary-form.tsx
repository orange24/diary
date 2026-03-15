"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createEntry, updateEntry, Entry } from "@/services/api"
import { Loader2, Film, Image as ImageIcon, X } from "lucide-react"
import { toast } from "sonner"

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null; 
  token: string;
  userId: number | undefined;
}

export function DiaryForm({ onSuccess, initialData, token, userId }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<{url: string, type: string}[]>([])
  const [existingMedia, setExistingMedia] = useState<string[]>(initialData?.images || [])

  const STORED_URL = process.env.NEXT_PUBLIC_STORED_URL;

  // ฟังก์ชันเช็คประเภทไฟล์
  const isVideo = (path: string) => {
    const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg'];
    return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
  };

  // ✅ แก้ไข Cleanup: ให้ล้างเฉพาะตอนปิดฟอร์ม (Unmount) เท่านั้น
  useEffect(() => {
    return () => {
      // ใช้ตัวแปร previews ล่าสุดล้างข้อมูลใน Memory
      previews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, []); // ⚠️ ใส่ [] เพื่อให้ทำงานแค่ตอน "ทิ้ง" คอมโพเนนต์นี้เท่านั้น

  useEffect(() => {
    setExistingMedia(initialData?.images || [])
    // ล้างไฟล์เก่าเมื่อมีการเปลี่ยน initialData (เช่น เปลี่ยนการแก้ไขระหว่างแถว)
    previews.forEach(p => URL.revokeObjectURL(p.url));
    setSelectedFiles([])
    setPreviews([])
  }, [initialData])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      const validFiles = filesArray.filter(file => file.size <= 50 * 1024 * 1024)
      
      if (validFiles.length !== filesArray.length) {
        toast.error("บางไฟล์มีขนาดใหญ่เกิน 50MB");
      }

      // สร้าง Preview URL ใหม่
      const newPreviews = validFiles.map(file => ({
        url: URL.createObjectURL(file),
        type: file.type
      }))

      setSelectedFiles(prev => [...prev, ...validFiles])
      setPreviews(prev => [...prev, ...newPreviews])
    }
  }

  const removeNewFile = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingMedia = (index: number) => {
    setExistingMedia(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token) return toast.error("กรุณาเข้าสู่ระบบใหม่");

    setLoading(true)
    const formData = new FormData(e.currentTarget);
    let uploadedPaths: string[] = [];

    try {
        // 1. อัปโหลดไฟล์ใหม่ (ถ้ามี)
        if (selectedFiles.length > 0) {
        const mediaData = new FormData();
        mediaData.append("userId", String(userId || 0));
        selectedFiles.forEach(file => mediaData.append("media", file));

        const uploadRes = await fetch(`${STORED_URL}/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }, // ส่ง Token ตามที่เราแก้กัน
            body: mediaData,
        });

        if (!uploadRes.ok) throw new Error("Upload failed");
        
        const resData = await uploadRes.json();
        uploadedPaths = resData.paths || []; // นี่คือ Path ใหม่จาก Server (เช่น ["/uploads/xxx.jpg"])
        }

        // 2. รวม Path เดิมที่เหลืออยู่ + Path ใหม่ที่เพิ่งอัปโหลด
        const allImages = [...existingMedia, ...uploadedPaths];

        // 3. เตรียม Payload ส่งให้ API บันทึก (Create/Update)
        const payload = {
        title: formData.get("title") as string,
        content: formData.get("content") as string,
        images: allImages, // ⚠️ เช็คว่า Key นี้ตรงกับที่ Go รอรับใน Struct หรือไม่
        created_by: "Watchara",
        };

        if (initialData?.id) {
        await updateEntry(initialData.id, payload, token);
        } else {
        await createEntry(payload, token);
        }

        onSuccess();
    } catch (err: any) {
        toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    } finally {
        setLoading(false);
    }
    };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input 
        name="title" 
        placeholder="หัวข้อไดอารี่" 
        required 
        defaultValue={initialData?.title || ""} 
        className="text-lg font-bold" 
      />
      <Textarea 
        name="content" 
        placeholder="วันนี้เป็นอย่างไรบ้าง..." 
        required 
        defaultValue={initialData?.content || ""} 
        className="h-40 resize-none" 
      />
      
      {/* ส่วน Upload */}
      <div className="border-2 border-dashed rounded-xl p-6 bg-slate-50/50 text-center relative hover:bg-slate-50 transition-colors border-slate-200">
        <input 
          type="file" 
          multiple 
          accept="image/*,video/*" 
          onChange={handleFileChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
        />
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="flex gap-2">
            <ImageIcon size={28} strokeWidth={1.5} />
            <Film size={28} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium">คลิกหรือลากวางรูปภาพ/วิดีโอ</p>
        </div>
      </div>

      {/* --- ส่วนแสดงรูป Thumbnails --- */}
      <div className="grid grid-cols-4 gap-3">
        {/* รูปเดิมใน Database */}
        {existingMedia.map((path, i) => (
          <div key={`old-${i}`} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-100">
            {isVideo(path) ? (
              <video src={`${STORED_URL}${path}`} className="w-full h-full object-cover" />
            ) : (
              <img src={`${STORED_URL}${path}`} className="w-full h-full object-cover" alt="old" />
            )}
            <button 
              type="button" 
              onClick={() => removeExistingMedia(i)}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-red-500 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        {/* รูปใหม่ที่เพิ่งเลือก (Thumbnails) */}
        {previews.map((p, i) => (
          <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden border-2 border-primary/30 shadow-sm animate-in zoom-in-50 duration-200">
            {p.type.startsWith('video') ? (
              <video src={p.url} className="w-full h-full object-cover" />
            ) : (
              <img src={p.url} className="w-full h-full object-cover" alt="new preview" />
            )}
            <button 
              type="button"
              onClick={() => removeNewFile(i)}
              className="absolute top-1 right-1 bg-primary text-white rounded-full p-1 shadow-md hover:bg-destructive transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : (initialData ? "อัปเดตไดอารี่" : "บันทึกเรื่องราววันนี้")}
      </Button>
    </form>
  )
}