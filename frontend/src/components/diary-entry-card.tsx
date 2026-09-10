"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Calendar } from "lucide-react"
// ✅ 1. Import DOMPurify
import DOMPurify from "isomorphic-dompurify"

interface DiaryEntry {
  id: string
  title: string
  content: string
  date: string
  images: string[]
}

interface DiaryEntryCardProps {
  entry: DiaryEntry
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

const isVideo = (path: string) => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
};

const getDisplayMedia = (path: string) => {
  if (!path) return "";
  
  if (path.startsWith('http')) {
    if (isVideo(path)) {
      return path.replace(/\/upload\//, "/upload/so_auto/").replace(/\.[^/.]+$/, ".jpg");
    }
    return path;
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:9090";
  const fullPath = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

  if (isVideo(path)) {
    const fileName = path.split('/').pop();
    return `${baseUrl}/uploads/thumb-${fileName}.jpg`;
  }

  return fullPath;
};

const getSummary = (html: string) => {
  // ลบ Tag HTML ออกทั้งหมดเพื่อเอาแค่ Text มาทำ Summary
  const cleanText = html.replace(/<[^>]*>?/gm, '');
  if (cleanText.length > 100) {
    return cleanText.substring(0, 100) + "...";
  }
  return cleanText;
};

export function DiaryEntryCard({ entry, onEdit, onDelete }: DiaryEntryCardProps) {
  // ✅ 3. กรอง HTML เพื่อความปลอดภัย (กรณีอยากแสดงผลแบบ Rich Text ใน Card)
  const sanitizedContent = DOMPurify.sanitize(entry.content);

  return (
    <Card className="bg-card hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Calendar className="size-3" />
          <span>{entry.date}</span>
        </div>
        <CardTitle className="text-lg line-clamp-1">{entry.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="pb-4 flex-grow space-y-3">
        {/* ✅ 4. เลือกใช้: แสดงแบบข้อความล้วน (Summary) หรือ Rich Text สั้นๆ */}
        <div 
          className="prose prose-sm dark:prose-invert text-muted-foreground leading-relaxed line-clamp-3"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
        />

        {entry.images && entry.images.length > 0 && (
          <div className="relative w-full h-40 overflow-hidden rounded-lg bg-gray-100 mt-2">
            <img
              src={getDisplayMedia(`${entry.images[0]}`)}
              alt={entry.title}
              className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
            />
            {entry.images.length > 1 && (
              <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-md font-medium">
                +{entry.images.length - 1} photos
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-2 pb-4 border-t bg-slate-50/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit?.(entry.id)}
          className="h-8 px-3 text-xs"
        >
          <Pencil className="size-3.5 mr-1" /> Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete?.(entry.id)}
          className="h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-3.5 mr-1" /> Delete
        </Button>
      </CardFooter>
    </Card>
  )
}