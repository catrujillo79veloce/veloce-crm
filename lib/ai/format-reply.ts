// ---------------------------------------------------------------------------
// Chat-native formatting for the bot's replies.
//
// The model writes like it writes for the web: **negrita**, listas con
// viñetas, algun encabezado. WhatsApp does NOT understand **double asterisks**
// (its bold is *one* asterisk) and Instagram/Messenger understand no markup at
// all, so the customer ends up reading "El Bike Fit esta en **$440.000**".
//
// The system prompt already asks for plain chat text. This is the safety net
// for when the model ignores it — which it does, the same way it ignores the
// "maximo 3-4 oraciones" rule.
//
// FORMATTING ONLY: never changes wording, figures or emojis. Every transform
// here either translates a markdown delimiter to its channel equivalent or
// drops a delimiter the channel would show literally.
//
// Call it with the text AFTER extractPhotoRequest() has pulled the
// [FOTO: ...] marker out. Markers are masked before transforming anyway — a
// sanitizer that mangles one sends the customer the wrong photo, or none — so
// the order is not load-bearing.
// ---------------------------------------------------------------------------

/** Channels we send bot replies to. WhatsApp is the only one with markup. */
export type ReplyChannel = "whatsapp" | "instagram" | "messenger"

// Same shape as product-photo.ts's marker, kept local: this module only needs
// to recognize a marker to leave it alone, not to parse it.
const PHOTO_MARKER = /\[FOTO:[^\]]*\]/gi

// NUL cannot appear in model output, so it is safe as a stand-in.
const MASK = "\u0000"
const MASKED = /\u0000(\d+)\u0000/g

/**
 * Make the bot's reply look like a message a person typed in this channel.
 * Returns "" for an empty reply, so callers can keep using their existing
 * "nothing to send" check.
 */
export function formatReplyForChannel(
  reply: string,
  channel: ReplyChannel
): string {
  if (!reply) return ""

  const markers: string[] = []
  const masked = reply.replace(PHOTO_MARKER, (match) => {
    markers.push(match)
    return `${MASK}${markers.length - 1}${MASK}`
  })

  const converted =
    channel === "whatsapp" ? toWhatsApp(masked) : toPlainText(masked)

  return unmask(tidy(converted), markers)
}

/**
 * Markup that is markdown-only on every channel: headings, bullet characters,
 * link syntax and backticks. A sales chat has no use for any of it.
 */
function stripStructuralMarkdown(text: string): string {
  return (
    text
      // "### Servicios" -> "Servicios"
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
      // "- item" / "* item" / "+ item" -> "• item". A real bullet reads as text
      // on both channels; a markdown dash reads as leftover syntax.
      .replace(/^[ \t]*[-*+][ \t]+(?=\S)/gm, "• ")
      // "[Orbea](https://...)" -> "Orbea: https://..." (both channels
      // auto-link a bare URL; neither renders the brackets).
      .replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_match, label: string, url: string) => {
          const shown = label.trim()
          return shown === url ? url : `${shown}: ${url}`
        }
      )
      // Monospace: no channel needs it and the backticks show up literally.
      .replace(/```+/g, "")
      .replace(/`([^`\n]+)`/g, "$1")
  )
}

/**
 * WhatsApp's own markup: *negrita*, _cursiva_, ~tachado~. Markdown's doubled
 * delimiters are translated down to the single ones; markdown's single `_x_`
 * already means italic here, so it is left alone.
 */
function toWhatsApp(text: string): string {
  return (
    stripStructuralMarkdown(text)
      .replace(/\*\*\*(?=\S)([^\n]*?\S)\*\*\*/g, "*$1*")
      .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, "*$1*")
      .replace(/__(?=\S)([^\n]*?\S)__/g, "*$1*")
      .replace(/~~(?=\S)([^\n]*?\S)~~/g, "~$1~")
      // Unpaired delimiters, which is what a reply cut off by max_tokens
      // mid-bold leaves behind.
      .replace(/\*{2,}|_{2,}|~{2,}/g, "")
  )
}

/**
 * Instagram DM and Messenger render no markup at all, so every delimiter comes
 * out — including the single ones WhatsApp would have used.
 */
function toPlainText(text: string): string {
  return (
    stripStructuralMarkdown(text)
      .replace(/(\*{1,3})(?=\S)([^\n]*?\S)\1/g, "$2")
      // Underscores only when they are not inside a word, so image_url and
      // the like survive.
      .replace(/(?<!\w)(_{1,3})(?=\S)([^\n]*?\S)\1(?!\w)/g, "$2")
      .replace(/~~(?=\S)([^\n]*?\S)~~/g, "$1")
      .replace(/\*{2,}|_{2,}|~{2,}/g, "")
  )
}

/** Tidy up the gaps the removed delimiters leave behind. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function unmask(text: string, markers: string[]): string {
  if (markers.length === 0) return text
  return text.replace(MASKED, (match, index: string) => {
    return markers[Number(index)] ?? match
  })
}
