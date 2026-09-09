"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface BookDialogContentProps extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean
}

// A DialogContent variant that opens like a book cover swinging open
// (CSS 3D rotateY — see .book-dialog-content in globals.css) instead of
// the default dialog's zoom/fade, with content sitting on a page-styled
// panel next to a spine strip. Built directly on the Radix primitives
// rather than the shared DialogContent, since that component's baked-in
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
          "book-dialog-content fixed top-1/2 left-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 sm:max-w-lg",
          className
        )}
        {...props}
      >
        <div className="relative overflow-hidden rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
          {/* Spine */}
          <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-logo/70 via-logo to-logo/90 shadow-[inset_-3px_0_6px_rgba(0,0,0,0.3)]" />
          {/* Page — deliberately always this cream paper color regardless of
              light/dark theme, same convention as the scrapbook canvas
              itself (which also stays white in both themes). Note: this
              project's dark mode is a custom [data-theme] attribute, not
              Tailwind's dark: class/media variant, so a dark: utility here
              would silently key off the OS's prefers-color-scheme instead
              of the app's own toggle — intentionally not used. */}
          <div className="relative ml-4 max-h-[95vh] overflow-y-auto bg-[#fdfaf3] p-6 shadow-[inset_10px_0_16px_-12px_rgba(0,0,0,0.15)]">
            {children}
            {showCloseButton && (
              <DialogPrimitive.Close className="absolute top-4 right-4 rounded-full p-1 text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
