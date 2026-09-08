"use client"

import { PlayCircle } from "lucide-react"
import { isVideo, getDisplayMedia } from "@/lib/media-utils"

interface GalleryMosaicProps {
  images: string[]
  onImageClick: (index: number) => void
}

interface TileProps {
  src: string
  index: number
  onClick: (index: number) => void
  overlayCount?: number
  className?: string
}

function Tile({ src, index, onClick, overlayCount, className = "" }: TileProps) {
  return (
    <div
      className={`relative cursor-pointer overflow-hidden border border-border transition-all duration-300 hover:brightness-90 ${className}`}
      onClick={() => onClick(index)}
    >
      <img
        src={getDisplayMedia(src)}
        className="size-full object-cover"
        alt="Media thumbnail"
        loading="lazy"
      />
      {isVideo(src) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <PlayCircle className="size-8 text-white opacity-90 drop-shadow-lg" />
        </div>
      )}
      {!!overlayCount && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">
          +{overlayCount}
        </div>
      )}
    </div>
  )
}

// Facebook-style photo mosaic: the grid shape adapts to how many images
// there are, cropping each into its cell (object-cover) the same way a
// social feed would rather than trying to preserve every original aspect
// ratio. 5+ images collapse to a 5-tile layout with a "+N" overlay on the
// last cell for whatever didn't fit.
export function GalleryMosaic({ images, onImageClick }: GalleryMosaicProps) {
  if (images.length === 0) return null

  const containerClass = "grid gap-1 rounded-xl overflow-hidden h-72"

  if (images.length === 1) {
    return (
      <div className={containerClass}>
        <Tile src={images[0]} index={0} onClick={onImageClick} className="rounded-xl" />
      </div>
    )
  }

  if (images.length === 2) {
    return (
      <div className={`${containerClass} grid-cols-2`}>
        <Tile src={images[0]} index={0} onClick={onImageClick} />
        <Tile src={images[1]} index={1} onClick={onImageClick} />
      </div>
    )
  }

  if (images.length === 3) {
    return (
      <div className={`${containerClass} grid-cols-2 grid-rows-2`}>
        <Tile src={images[0]} index={0} onClick={onImageClick} className="row-span-2" />
        <div className="grid h-full grid-rows-2 gap-1">
          <Tile src={images[1]} index={1} onClick={onImageClick} />
          <Tile src={images[2]} index={2} onClick={onImageClick} />
        </div>
      </div>
    )
  }

  if (images.length === 4) {
    return (
      <div className={`${containerClass} grid-cols-2 grid-rows-2`}>
        {images.map((src, index) => (
          <Tile key={index} src={src} index={index} onClick={onImageClick} />
        ))}
      </div>
    )
  }

  // 5 or more: 2 stacked on the left, 1 + a 2-way split on the right.
  const remaining = images.length - 5
  return (
    <div className={`${containerClass} grid-cols-2 grid-rows-1`}>
      <div className="grid h-full grid-rows-2 gap-1">
        <Tile src={images[0]} index={0} onClick={onImageClick} />
        <Tile src={images[1]} index={1} onClick={onImageClick} />
      </div>
      <div className="grid h-full grid-rows-2 gap-1">
        <Tile src={images[2]} index={2} onClick={onImageClick} />
        <div className="grid h-full grid-cols-2 gap-1">
          <Tile src={images[3]} index={3} onClick={onImageClick} />
          <Tile
            src={images[4]}
            index={4}
            onClick={onImageClick}
            overlayCount={remaining > 0 ? remaining : undefined}
          />
        </div>
      </div>
    </div>
  )
}
