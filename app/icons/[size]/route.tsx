import { ImageResponse } from "next/og"

// ---------------------------------------------------------------------------
// Dynamic PWA icon generator. /icons/192 and /icons/512 produce the app icon
// (white "V" on Veloce green) referenced by the manifest.
// ---------------------------------------------------------------------------

export const runtime = "edge"

export async function GET(
  _request: Request,
  { params }: { params: { size: string } }
) {
  const raw = parseInt(params.size, 10)
  const size = Number.isFinite(raw) ? Math.min(1024, Math.max(48, raw)) : 192

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
          color: "white",
          fontSize: size * 0.6,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        V
      </div>
    ),
    { width: size, height: size }
  )
}
