// Resizes an image file client-side and returns it as a small JPEG data:
// URI. Used for profile pictures specifically: registration happens before
// the user has a JWT, so the normal Cloudinary /upload endpoint (which
// requires one) isn't available yet — a data: URI sidesteps needing any
// upload endpoint at all, at the cost of a slightly bigger row in the
// users table (fine at this app's personal scale).
export function resizeImageToDataUrl(file: File, maxSize = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Couldn't read the selected file"))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("Couldn't read the selected image"))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const width = Math.round(img.width * scale)
        const height = Math.round(img.height * scale)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas isn't supported in this browser"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
