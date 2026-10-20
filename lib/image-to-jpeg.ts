// ---------------------------------------------------------------------------
// Normalize a product photo to JPEG, in the browser, before uploading.
//
// WhatsApp only accepts image/jpeg and image/png for image messages — WebP is
// sticker-only and gets rejected. Saving a photo from a brand's website gives
// you a .webp, so without this the bot could not send most product photos.
//
// Doing it client-side also decodes whatever the browser can display (iPhone
// HEIC included) and shrinks camera-sized files well under Meta's 5 MB cap,
// without adding a native image library to the serverless function.
// ---------------------------------------------------------------------------

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.9
/** Big enough that re-encoding a normal photo is pointless. */
const PASSTHROUGH_MAX_BYTES = 3 * 1024 * 1024

export async function toJpegFile(file: File): Promise<File> {
  if (file.type === "image/jpeg" && file.size <= PASSTHROUGH_MAX_BYTES) {
    return file
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(bitmap.width, bitmap.height)
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("El navegador no pudo procesar la imagen")

    // JPEG has no alpha channel: flatten onto white so a transparent PNG
    // does not come out with a black background.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    )
    if (!blob) throw new Error("No se pudo convertir la imagen a JPEG")

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto"
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" })
  } finally {
    bitmap.close()
  }
}
