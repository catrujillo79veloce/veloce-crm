// ---------------------------------------------------------------------------
// Tests for the reply formatter.
//
//   npm test
//
// The cases marked "real" are verbatim output the production model gave when
// asked the questions a customer actually asks (see scripts/probe-agent.ts).
// ---------------------------------------------------------------------------

import { test } from "node:test"
import assert from "node:assert/strict"

import { formatReplyForChannel } from "@/lib/ai/format-reply"

// --- The bug this module exists for --------------------------------------

test("real: WhatsApp gets single-asterisk bold, never **", () => {
  const reply = "El Bike Fit Retul 3D está en **$440.000** 🙌"

  assert.equal(
    formatReplyForChannel(reply, "whatsapp"),
    "El Bike Fit Retul 3D está en *$440.000* 🙌"
  )
})

test("real: Instagram gets no markup at all", () => {
  const reply = "El Bike Fit Retul 3D está en **$440.000** 🙌"

  assert.equal(
    formatReplyForChannel(reply, "instagram"),
    "El Bike Fit Retul 3D está en $440.000 🙌"
  )
})

test("real: a bulleted price list loses its markdown on both channels", () => {
  const reply = [
    "Tenemos tres opciones:",
    "- **Alistada Rápida**: $70.000",
    "- **Mantenimiento Completo**: $160.000",
    "- **Mantenimiento eBike**: $220.000",
    "¿Cuál te sirve?",
  ].join("\n")

  assert.equal(
    formatReplyForChannel(reply, "whatsapp"),
    [
      "Tenemos tres opciones:",
      "• *Alistada Rápida*: $70.000",
      "• *Mantenimiento Completo*: $160.000",
      "• *Mantenimiento eBike*: $220.000",
      "¿Cuál te sirve?",
    ].join("\n")
  )

  assert.equal(
    formatReplyForChannel(reply, "messenger"),
    [
      "Tenemos tres opciones:",
      "• Alistada Rápida: $70.000",
      "• Mantenimiento Completo: $160.000",
      "• Mantenimiento eBike: $220.000",
      "¿Cuál te sirve?",
    ].join("\n")
  )
})

test("real: indoor packages keep every figure untouched", () => {
  const reply = [
    "Los planes mensuales son:",
    "- **2 veces/semana:** $320.000",
    "- **3 veces/semana:** $410.000",
    "- **4 veces/semana:** $490.000",
  ].join("\n")

  for (const channel of ["whatsapp", "instagram", "messenger"] as const) {
    const out = formatReplyForChannel(reply, channel)
    assert.ok(!out.includes("**"), `${channel} still has **`)
    for (const price of ["$320.000", "$410.000", "$490.000"]) {
      assert.ok(out.includes(price), `${channel} lost ${price}`)
    }
  }
})

// --- The [FOTO: ...] marker ----------------------------------------------

test("the photo marker survives verbatim", () => {
  const reply =
    "¡Claro que sí! 📸 Te mando la **Orbea Orca M30**.\n[FOTO: Orbea Orca M30]"

  assert.equal(
    formatReplyForChannel(reply, "whatsapp"),
    "¡Claro que sí! 📸 Te mando la *Orbea Orca M30*.\n[FOTO: Orbea Orca M30]"
  )
  assert.equal(
    formatReplyForChannel(reply, "instagram"),
    "¡Claro que sí! 📸 Te mando la Orbea Orca M30.\n[FOTO: Orbea Orca M30]"
  )
})

test("a marker the model bolded still comes out intact", () => {
  // Would be stripped by extractPhotoRequest first in production; the
  // formatter must not be the thing that breaks it.
  const reply = "Mira esta 👇\n**[FOTO: Orbea Orca M30]**"

  for (const channel of ["whatsapp", "instagram"] as const) {
    assert.ok(
      formatReplyForChannel(reply, channel).includes("[FOTO: Orbea Orca M30]"),
      `${channel} mangled the marker`
    )
  }
})

test("markdown inside the marker name is left alone", () => {
  // The name has to match the catalog byte-for-byte, so nothing in it may be
  // rewritten — not even something that looks like markup.
  const reply = "Ahí va.\n[FOTO: Kit Veloce *Pro* 2_0]"
  const out = formatReplyForChannel(reply, "instagram")

  assert.ok(out.includes("[FOTO: Kit Veloce *Pro* 2_0]"))
})

test("two markers both survive (the webhook drops the extra, not us)", () => {
  const reply = "Van las dos.\n[FOTO: Orbea Orca M30]\n[FOTO: Colnago V3 Di2]"
  const out = formatReplyForChannel(reply, "whatsapp")

  assert.ok(out.includes("[FOTO: Orbea Orca M30]"))
  assert.ok(out.includes("[FOTO: Colnago V3 Di2]"))
})

// --- Other markdown the model reaches for --------------------------------

test("headings lose the hashes, not the words", () => {
  assert.equal(
    formatReplyForChannel("## Servicios de taller\nTe cuento.", "whatsapp"),
    "Servicios de taller\nTe cuento."
  )
})

test("underscore bold becomes WhatsApp bold and plain text elsewhere", () => {
  assert.equal(
    formatReplyForChannel("Queda __casi nueva__.", "whatsapp"),
    "Queda *casi nueva*."
  )
  assert.equal(
    formatReplyForChannel("Queda __casi nueva__.", "instagram"),
    "Queda casi nueva."
  )
})

test("WhatsApp keeps single-underscore italics, Instagram drops them", () => {
  assert.equal(
    formatReplyForChannel("Es _único_ en Medellín.", "whatsapp"),
    "Es _único_ en Medellín."
  )
  assert.equal(
    formatReplyForChannel("Es _único_ en Medellín.", "instagram"),
    "Es único en Medellín."
  )
})

test("strikethrough drops to one tilde for WhatsApp", () => {
  assert.equal(
    formatReplyForChannel("Antes ~~$11.299.000~~, ahora $10.299.000.", "whatsapp"),
    "Antes ~$11.299.000~, ahora $10.299.000."
  )
  assert.equal(
    formatReplyForChannel("Antes ~~$11.299.000~~, ahora $10.299.000.", "messenger"),
    "Antes $11.299.000, ahora $10.299.000."
  )
})

test("markdown links become a bare URL the channel can autolink", () => {
  assert.equal(
    formatReplyForChannel(
      "Mira el catálogo [Orbea](https://www.orbea.com/co-es/).",
      "whatsapp"
    ),
    "Mira el catálogo Orbea: https://www.orbea.com/co-es/."
  )
})

test("a link whose text is the URL is not duplicated", () => {
  assert.equal(
    formatReplyForChannel(
      "[https://14ochomiles.com/](https://14ochomiles.com/)",
      "instagram"
    ),
    "https://14ochomiles.com/"
  )
})

test("backticks come off", () => {
  assert.equal(
    formatReplyForChannel("El código es `VELOCE10`.", "whatsapp"),
    "El código es VELOCE10."
  )
})

test("triple asterisks collapse, they do not leave one behind", () => {
  assert.equal(
    formatReplyForChannel("***Última unidad***", "whatsapp"),
    "*Última unidad*"
  )
  assert.equal(
    formatReplyForChannel("***Última unidad***", "instagram"),
    "Última unidad"
  )
})

// --- Things the formatter must NOT touch ---------------------------------

test("an underscore inside a word stays", () => {
  const reply = "Pídele a un asesor el archivo bike_fit_retul.pdf 📄"

  assert.equal(formatReplyForChannel(reply, "instagram"), reply)
  assert.equal(formatReplyForChannel(reply, "whatsapp"), reply)
})

test("a plain reply comes out byte-for-byte", () => {
  const reply =
    "¡Hola! 🚴 Soy el asistente de Veloce. ¿En qué te puedo ayudar hoy?"

  for (const channel of ["whatsapp", "instagram", "messenger"] as const) {
    assert.equal(formatReplyForChannel(reply, channel), reply)
  }
})

test("prices, emojis and question marks survive every channel", () => {
  const reply = "La Orca M30 está en $10.299.000 🔥 ¿Te la separo con el 30%?"

  for (const channel of ["whatsapp", "instagram", "messenger"] as const) {
    assert.equal(formatReplyForChannel(reply, channel), reply)
  }
})

test("a lone asterisk is not treated as an opening delimiter", () => {
  const reply = "Quedan tallas S y M* y un par de L."

  assert.equal(formatReplyForChannel(reply, "instagram"), reply)
})

// --- Leftovers and odd input ---------------------------------------------

test("a reply cut off mid-bold does not ship stray asterisks", () => {
  // max_tokens is 400, so a truncated reply is a real case.
  const reply = "Tenemos la **Orbea Orca M30** y la **Cervelo"

  assert.equal(
    formatReplyForChannel(reply, "whatsapp"),
    "Tenemos la *Orbea Orca M30* y la Cervelo"
  )
  assert.equal(
    formatReplyForChannel(reply, "instagram"),
    "Tenemos la Orbea Orca M30 y la Cervelo"
  )
})

test("blank lines left by removed markup are collapsed", () => {
  assert.equal(
    formatReplyForChannel("Hola.\n\n\n\n¿Te agendo?", "whatsapp"),
    "Hola.\n\n¿Te agendo?"
  )
})

test("surrounding whitespace is trimmed", () => {
  assert.equal(formatReplyForChannel("  \n Hola. \n ", "whatsapp"), "Hola.")
})

test("an empty reply stays empty so the caller's guard still fires", () => {
  assert.equal(formatReplyForChannel("", "whatsapp"), "")
  assert.equal(formatReplyForChannel("   ", "instagram"), "")
})
