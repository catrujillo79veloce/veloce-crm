"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/Toast"

// ---------------------------------------------------------------------------
// Overlay button to upload/replace a product photo from the grid.
// ---------------------------------------------------------------------------

export default function ProductImageButton({
  productId,
  hasImage,
}: {
  productId: string
  hasImage: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/products/${productId}/image`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        toast("error", data.error ?? "Error subiendo la foto")
      } else {
        toast("success", "Foto actualizada")
        router.refresh()
      }
    } catch {
      toast("error", "Error de red")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-white/90 hover:bg-white text-gray-700 text-xs font-medium px-2 py-1 rounded-lg shadow-sm border border-gray-200"
        title={hasImage ? "Cambiar foto" : "Subir foto"}
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Camera className="w-3.5 h-3.5" />
        )}
        {hasImage ? "Cambiar" : "Foto"}
      </button>
    </>
  )
}
