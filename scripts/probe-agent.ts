// ---------------------------------------------------------------------------
// Ask the real Veloce bot a question and print its reply.
//
// Used to verify prompt changes against the live model + live catalog instead
// of by eyeballing the prompt. The bot quotes prices to paying customers, so
// "it looks right in the diff" is not evidence.
//
// The ANTHROPIC_API_KEY in .env.local is dead; pull the production env first:
//   npx vercel env pull <tmp>/.env.prod --environment=production --yes
//   npx tsx --env-file=<tmp>/.env.prod scripts/probe-agent.ts "pregunta"
// ...and delete that file afterwards — it holds every production secret.
//
//   --catalog   print the catalog block the bot receives, then exit
// ---------------------------------------------------------------------------

import { generateAgentResponse } from "@/lib/ai/veloce-agent"
import { getCatalogBlock } from "@/lib/ai/catalog-context"
import {
  extractPhotoRequest,
  findProductPhoto,
} from "@/lib/ai/product-photo"
import { formatReplyForChannel } from "@/lib/ai/format-reply"

async function main() {
  const args = process.argv.slice(2)

  if (args.includes("--catalog")) {
    console.log(await getCatalogBlock())
    return
  }

  const question = args.join(" ").trim()
  if (!question) {
    console.error('Uso: probe-agent.ts "pregunta del cliente"  |  --catalog')
    process.exit(2)
  }

  const reply = await generateAgentResponse(question)
  if (!reply) {
    console.log("RESULTADO: LA_IA_FALLO")
    process.exit(1)
  }

  const { text, productName } = extractPhotoRequest(reply)

  // Resolve the marker too: a name the bot invents looks fine in the reply but
  // sends no image, so the only honest check is whether a photo comes back.
  const photo = productName ? await findProductPhoto(productName) : null

  console.log("PREGUNTA: " + question)
  // CRUDO is what the model wrote; WHATSAPP / INSTAGRAM are what the customer
  // actually reads, after the formatter. Compare them to see whether the
  // prompt's formatting rule held or the safety net had to catch it.
  console.log("CRUDO: " + text)
  console.log("WHATSAPP: " + formatReplyForChannel(text, "whatsapp"))
  console.log("INSTAGRAM: " + formatReplyForChannel(text, "instagram"))
  console.log("FOTO_PEDIDA: " + (productName ?? "(ninguna)"))
  console.log(
    "FOTO_ENVIADA: " +
      (photo
        ? `${photo.name} <- ${photo.imageUrl.split("/").pop()}`
        : productName
          ? "(NINGUNA - la marca no resolvio a ningun producto con foto)"
          : "(ninguna)")
  )
}

main()
