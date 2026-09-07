"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { ScrapElement, ImageScrapElement, PAGE_WIDTH } from "@/types/scrapbook"
import { createEntry, updateEntry, Entry } from "@/services/api"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null;
  token: string | undefined;
  userId: number | undefined;
}

export function DiaryForm({ onSuccess, initialData, token, userId }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialData?.title || "")
  const [elements, setElements] = useState<ScrapElement[]>(initialData?.layout?.elements || [])

  useEffect(() => {
    setTitle(initialData?.title || "")
    setElements(initialData?.layout?.elements || [])
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return toast.error("กรุณาเข้าสู่ระบบใหม่");
    if (!title.trim()) return toast.error("กรุณากรอกหัวข้อ");

    setLoading(true)

    try {
      const images = elements
        .filter((el): el is ImageScrapElement => el.type === "image")
        .map((el) => el.src)

      const payload = {
        title,
        content: "",
        images,
        created_by: "Watchara",
        layout: { pageWidth: PAGE_WIDTH, elements },
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
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">หัวข้อเรื่องราว</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ระบุหัวข้อไดอารี่..."
          required
          className="text-lg font-bold bg-card"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">ตกแต่งหน้าบันทึก</label>
        <ScrapbookEditor elements={elements} onChange={setElements} editable token={token} />
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-lg font-bold bg-logo text-logo-foreground shadow-lg shadow-logo/20 hover:bg-logo/90"
        disabled={loading}
      >
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : (initialData ? "อัปเดตไดอารี่" : "บันทึกเรื่องราววันนี้")}
      </Button>
    </form>
  )
}
