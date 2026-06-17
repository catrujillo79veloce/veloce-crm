// ---------------------------------------------------------------------------
// Single source of truth for Anthropic model IDs.
//
// Anthropic retires dated model SNAPSHOTS on a schedule. On 2026-06-15 the
// pinned "claude-sonnet-4-20250514" was retired and the whole bot went down
// for ~2 days. To make the next swap a one-line / one-env change instead of a
// multi-file hunt:
//   - use ALIASES here (no date suffix) so they track the latest minor, and
//   - allow a per-env override so the model can be rolled without a deploy.
//
// When changing models, see the Anthropic models reference for the current
// alias (e.g. claude-sonnet-4-6, claude-haiku-4-5, claude-opus-4-8).
// ---------------------------------------------------------------------------

/** Conversational sales bot (WhatsApp / IG / FB replies). */
export const CHAT_MODEL = process.env.ANTHROPIC_CHAT_MODEL ?? "claude-sonnet-4-6"

/** Image captioning (vision). */
export const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL ?? "claude-sonnet-4-6"

/** Cheap, fast intent classification. */
export const INTENT_MODEL = process.env.ANTHROPIC_INTENT_MODEL ?? "claude-haiku-4-5"
