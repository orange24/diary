const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov']

export const isVideo = (path: string) => {
  return VIDEO_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext))
}

export const getDisplayMedia = (path: string) => {
  if (!path) return ""

  if (path.startsWith('http')) {
    if (isVideo(path)) {
      return path.replace(/\/upload\//, "/upload/so_auto/").replace(/\.[^/.]+$/, ".jpg")
    }
    return path
  }

  const baseUrl = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:9090"
  const fullPath = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`

  if (isVideo(path)) {
    const fileName = path.split('/').pop()
    return `${baseUrl}/uploads/thumb-${fileName}.jpg`
  }

  return fullPath
}
