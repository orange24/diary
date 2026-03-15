"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createEntry } from "@/services/api"

export default function CreateEntryPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...filesArray])
      
      // สร้าง Preview ให้ผู้ใช้เห็น
      const urls = filesArray.map(file => URL.createObjectURL(file))
      setPreviews(prev => [...prev, ...urls])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // 1. อัปโหลดรูปไปที่ Go ก่อน
    const imageFormData = new FormData()
    selectedFiles.forEach(file => imageFormData.append("images", file))

    const uploadRes = await fetch(process.env.NEXT_PUBLIC_STORED_URL + "/upload", {
      method: "POST",
      body: imageFormData,
    })
    const { paths } = await uploadRes.json() // ได้ Path กลับมา เช่น ["/uploads/1.jpg", "/uploads/2.jpg"]

    // 2. ส่งข้อมูลบันทึก + Path รูปไปบันทึกใน DB
    const entryData = {
      title: formData.get("title") as string,
      content: formData.get("content") as string,
      created_by: "Admin", // หรือดึงจากระบบ Login
      images: paths,       // ส่ง Array ของ Path ไป
    }

    await createEntry(entryData)
    router.push("/")
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 max-w-xl mx-auto space-y-4">
      <Input name="title" placeholder="หัวข้อ" required />
      <textarea name="content" className="w-full border p-2 rounded h-32" placeholder="เนื้อหา..." required />
      
      <div className="border-2 border-dashed p-4">
        <input type="file" multiple onChange={handleFileChange} accept="image/*,video/*" />
        <div className="grid grid-cols-4 gap-2 mt-4">
          {previews.map((url, i) => (
            <img key={i} src={url} className="h-20 w-20 object-cover rounded" />
          ))}
        </div>
      </div>

      <Button className="bg-[hsl(var(--primary))] text-white hover:opacity-90">
        บันทึกไดอารี่
      </Button>
    </form>
  )
}