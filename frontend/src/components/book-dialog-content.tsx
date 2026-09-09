"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface BookDialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
}

// A DialogContent variant that looks closed at first (a cover flap hides
// the page) and swings open along the spine to reveal the page — see
// .book-dialog-cover in globals.css. The page itself never moves; only
// the cover rotates away, so the writing surface is already in place the
// instant it's revealed. Built directly on the Radix primitives rather
// than the shared DialogContent, since that component's baked-in
// animate-in/zoom-in classes would otherwise fight this one's animation.
export function BookDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: BookDialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "book-dialog-content fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg",
          className
        )}
        {...props}
      >
        <div className="relative overflow-hidden rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
          {/* Spine — stays put whether the cover is open or closed. */}
          <div className="absolute inset-y-0 left-0 z-0 w-4 bg-gradient-to-r from-logo/70 via-logo to-logo/90 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.3)]" />

          {/* Page — deliberately always this cream paper color regardless of
              light/dark theme, same convention as the scrapbook canvas
              itself (which also stays white in both themes). Note: this
              project's dark mode is a custom [data-theme] attribute, not
              Tailwind's dark: class/media variant, so a dark: utility here
              would silently key off the OS's prefers-color-scheme instead
              of the app's own toggle — intentionally not used. Already
              "open" and ready to write on the moment the cover reveals it. */}
          <div className="relative z-10 ml-4 max-h-[95vh] overflow-y-auto bg-[#fdfaf3] p-6 shadow-[inset_10px_0_16px_-12px_rgba(0,0,0,0.15)]">
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>

          {/* Cover — hinged at the spine, hides the page until it opens. */}
          <div className="book-dialog-cover absolute inset-y-0 right-0 left-4 z-20 flex items-center justify-center bg-gradient-to-br from-logo to-logo/85 shadow-[inset_-6px_0_10px_rgba(0,0,0,0.15)]">
            <span className="text-5xl drop-shadow-sm">✍️</span>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
