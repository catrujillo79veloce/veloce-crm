"use client"

import { useState } from "react"
import {
  FileText,
  Mic,
  Image as ImageIcon,
  Film,
  Sticker,
  Volume2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// MessageMedia
// Renders the media attachment portion of a chat bubble: image, audio
// player + transcription, video, document link, or sticker.
// ---------------------------------------------------------------------------

interface MessageMediaProps {
  url: string | null | undefined
  type: string | null | undefined
  mime?: string | null | undefined
  transcription?: string | null | undefined
  visionCaption?: string | null | undefined
  isOutbound?: boolean
}

export default function MessageMedia({
  url,
  type,
  mime,
  transcription,
  visionCaption,
  isOutbound,
}: MessageMediaProps) {
  const [lightbox, setLightbox] = useState(false)

  if (!url || !type) return null

  if (type === "image" || type === "sticker") {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block rounded-lg overflow-hidden cursor-zoom-in -mx-1 -mt-1 mb-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={visionCaption ?? "Imagen del cliente"}
            className={cn(
              "max-w-[280px] max-h-[280px] object-cover",
              type === "sticker" && "max-w-[140px] max-h-[140px] bg-transparent"
            )}
            loading="lazy"
          />
        </button>
        {visionCaption && (
          <p
            className={cn(
              "text-[10px] italic mt-1 leading-snug",
              isOutbound ? "text-green-700/70" : "text-gray-500"
            )}
            title="Descripcion generada por IA"
          >
            <ImageIcon className="inline w-3 h-3 mr-0.5" />
            {visionCaption}
          </p>
        )}

        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center cursor-zoom-out"
            onClick={() => setLightbox(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={visionCaption ?? "Imagen ampliada"}
              className="max-w-[95vw] max-h-[90vh] object-contain"
            />
          </div>
        )}
      </>
    )
  }

  if (type === "audio") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Mic
            className={cn(
              "w-4 h-4 flex-shrink-0",
              isOutbound ? "text-green-700" : "text-gray-500"
            )}
          />
          <audio
            controls
            src={url}
            preload="metadata"
            className="h-9 w-full max-w-[260px]"
          />
        </div>
        {transcription && (
          <p
            className={cn(
              "text-xs leading-snug border-l-2 pl-2 italic",
              isOutbound
                ? "text-green-800 border-green-300"
                : "text-gray-700 border-gray-300"
            )}
            title="Transcripcion automatica"
          >
            <Volume2 className="inline w-3 h-3 mr-0.5 -mt-0.5" />
            {transcription}
          </p>
        )}
      </div>
    )
  }

  if (type === "video") {
    return (
      <video
        controls
        src={url}
        preload="metadata"
        className="rounded-lg max-w-[320px] max-h-[320px] -mx-1 -mt-1 mb-1"
      />
    )
  }

  if (type === "document") {
    const filename = decodeURIComponent(
      url.split("/").pop()?.split("?")[0] ?? "documento"
    )
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm hover:underline",
          isOutbound
            ? "bg-green-50/50 border-green-200 text-green-900"
            : "bg-white border-gray-200 text-gray-900"
        )}
      >
        <FileText className="w-5 h-5 flex-shrink-0" />
        <span className="truncate max-w-[200px]">{filename}</span>
      </a>
    )
  }

  // Fallback for any unknown media type
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-xs underline",
        isOutbound ? "text-green-700" : "text-gray-600"
      )}
    >
      {type === "video" ? (
        <Film className="w-3.5 h-3.5" />
      ) : type === "sticker" ? (
        <Sticker className="w-3.5 h-3.5" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      Ver {type ?? "archivo"} ({mime ?? "?"})
    </a>
  )
}
