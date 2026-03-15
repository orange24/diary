"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Calendar } from "lucide-react"

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

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_STORED_URL;

export function DiaryEntryCard({ entry, onEdit, onDelete }: DiaryEntryCardProps) {
  console.log(`Entry ID: ${entry.id} | Images:`, entry.images);
  return (
    <Card className="bg-card hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Calendar className="size-3" />
          <span>{entry.date}</span>
        </div>
        <CardTitle className="text-lg line-clamp-1">{entry.title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
          {entry.content}
        </p>
        {entry.images && entry.images.length > 0 && (
          <div className="relative w-full h-48 overflow-hidden rounded-t-lg bg-gray-100">
            <img
              src={`${IMAGE_BASE_URL}${entry.images[0]}`}
              alt={entry.title}
              className="w-full h-full object-cover"
            />
            {entry.images.length > 1 && (
              <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                +{entry.images.length - 1} รูป
              </span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit?.(entry.id)}
          aria-label="Edit entry"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete?.(entry.id)}
          aria-label="Delete entry"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
