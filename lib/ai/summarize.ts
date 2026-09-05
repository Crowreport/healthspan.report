/**
 * AI summaries for content items, via the Vercel AI SDK.
 *
 * Produces a short bullet-point summary of an rss_items row. Deliberately a
 * plain module rather than a "use server" file so the route handler can own
 * auth and rate limiting, and so this stays unit-testable without a session.
 *
 * GUARDRAILS. This summarizes health and longevity research for a general
 * audience, so the output carries three constraints:
 *
 *   1. Every summary ships with DISCLAIMER attached. It is part of the return
 *      value, not something the caller is trusted to remember to add.
 *   2. The prompt forbids inventing findings, forbids personalized medical
 *      advice, and requires the model to stay inside the supplied text.
 *   3. `basis` reports which text the summary came from, so a summary drawn
 *      from a one-line excerpt is not presented as if it summarized a study.
 *
 * The model is never asked to interpret, recommend, or extrapolate — only to
 * compress what the source already says.
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ItemSummary, SummaryBasis } from "@/types/database";

/**
 * The label every summary carries. Exported so a UI can render it verbatim and
 * so a test can assert it is present.
 */
export const DISCLAIMER =
  "AI-generated summary, not medical advice. It may contain errors — read the original source and consult a clinician for personal health decisions.";

const SUMMARY_MODEL = "gpt-4o-mini";

/** Enough text to summarize meaningfully rather than paraphrasing a headline. */
const MIN_GOOD_CONTENT = 500;
/** Cap on text sent to the model, mirroring MAX_ARTICLE_CHARS in chat/prompts. */
const MAX_SUMMARY_INPUT_CHARS = 12_000;

const MIN_BULLETS = 2;
const MAX_BULLETS = 5;
/** Discards fragments like "—" or "N/A" that survive marker stripping. */
const MIN_BULLET_LENGTH = 12;
const MAX_BULLET_LENGTH = 300;

const SYSTEM_PROMPT = `You summarize health, longevity, and medical research articles for curious non-specialist readers on Healthspan.report.

Return ONLY a bullet list of 3 to 5 bullets. One line per bullet, each starting with "- ". No heading, no preamble, no closing remark, no markdown beyond the bullet markers.

Each bullet:
- One sentence, under 30 words, plain language.
- States a specific finding, claim, or takeaway from the text.

Hard rules:
- Use ONLY the text provided. Do not add context, studies, statistics, or mechanisms that are not in it.
- Never invent findings, numbers, study names, or researchers. If the text is thin, write fewer bullets rather than filling them out.
- Report what the source claims, attributing where it matters ("the study found...", "the author argues..."). Do not endorse.
- Preserve the source's own hedging. If it says "may" or "in mice", your bullet says so too.
- Never give medical advice, dosages, or personal recommendations, even if the source does.`;

export interface SummarizeInput {
  itemId: string;
  title: string;
  excerpt: string | null;
  /** Full text when available — extracted_content or content. */
  content: string | null;
  sourceName: string | null;
}

export type SummarizeOutcome =
  | { ok: true; summary: ItemSummary }
  | { ok: false; error: string; code: "insufficient_content" | "model_error" };

/**
 * Pick the best available text and say what it was.
 *
 * `title_only` is a real outcome, not a fallback to summarize: an item with
 * nothing but a headline cannot be summarized honestly, and the caller rejects
 * it rather than letting the model pad a title into five confident bullets.
 */
function resolveBasis(input: SummarizeInput): {
  text: string;
  basis: SummaryBasis;
} {
  const content = input.content?.trim() ?? "";
  if (content.length >= MIN_GOOD_CONTENT) {
    return { text: content, basis: "full_content" };
  }

  const excerpt = input.excerpt?.trim() ?? "";

  // Neither clears the bar. Take whichever is longer — a 400-char content field
  // still beats a 50-char excerpt — but report it as `excerpt` regardless of
  // which column it came from. The label describes the strength of the basis,
  // not its provenance, and sub-threshold text is excerpt-grade either way.
  const best = content.length > excerpt.length ? content : excerpt;
  if (best) {
    return { text: best, basis: "excerpt" };
  }

  return { text: "", basis: "title_only" };
}

/**
 * Turn the model's bullet list into clean strings.
 *
 * Tolerant of the shapes models actually emit — "-", "*", "•", "1.", stray
 * bold markers, and the occasional lead-in line — because a strict parser here
 * turns a cosmetically-off response into a user-visible failure.
 */
export function parseBullets(raw: string): string[] {
  const bullets: string[] = [];

  for (const line of raw.split("\n")) {
    let text = line.trim();
    if (!text) continue;

    const hadMarker = /^([-*•‣–—]|\d+[.)])\s+/.test(text);
    text = text.replace(/^([-*•‣–—]|\d+[.)])\s+/, "");

    // Drop surrounding markdown emphasis and any trailing colon from a
    // "Key points:" style lead-in the prompt asked the model not to write.
    text = text.replace(/\*\*/g, "").replace(/^_+|_+$/g, "").trim();

    // Without a marker this is prose, not a bullet — a preamble or a sign-off.
    if (!hadMarker) continue;
    if (text.length < MIN_BULLET_LENGTH) continue;

    bullets.push(text.slice(0, MAX_BULLET_LENGTH));
    if (bullets.length >= MAX_BULLETS) break;
  }

  return bullets;
}

/**
 * Summarize one item into bullet points.
 *
 * Returns a discriminated outcome rather than throwing, so the route can map
 * "not enough text" (422) and "the model failed" (502) to different statuses
 * instead of collapsing both into a 500.
 */
export async function summarizeItem(
  input: SummarizeInput
): Promise<SummarizeOutcome> {
  const { text, basis } = resolveBasis(input);

  if (basis === "title_only" || !text) {
    return {
      ok: false,
      code: "insufficient_content",
      error: "This item has no summarizable text yet",
    };
  }

  const truncated =
    text.length > MAX_SUMMARY_INPUT_CHARS
      ? text.slice(0, MAX_SUMMARY_INPUT_CHARS) + "\n\n[…truncated]"
      : text;

  const prompt = [
    `Title: ${input.title || "(untitled)"}`,
    input.sourceName ? `Source: ${input.sourceName}` : null,
    basis === "excerpt"
      ? "NOTE: only a short excerpt is available. Write fewer bullets and do not extrapolate beyond it."
      : null,
    "",
    "Text to summarize:",
    "---",
    truncated,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  // Resolved once so the reported model is the one that actually ran, rather
  // than the default constant.
  const modelId = process.env.OPENAI_SUMMARY_MODEL || SUMMARY_MODEL;

  let raw: string;
  try {
    const result = await generateText({
      model: openai(modelId),
      system: SYSTEM_PROMPT,
      prompt,
    });
    raw = result.text;
  } catch (err) {
    console.error("[summarize] model call failed:", err);
    return {
      ok: false,
      code: "model_error",
      error: "Could not generate a summary right now",
    };
  }

  const bullets = parseBullets(raw);

  // Too few usable bullets means the model returned prose or refused. Failing
  // is better than surfacing a one-line "summary" that reads like an error.
  if (bullets.length < MIN_BULLETS) {
    console.error("[summarize] unparseable model output:", raw.slice(0, 300));
    return {
      ok: false,
      code: "model_error",
      error: "Could not generate a summary right now",
    };
  }

  return {
    ok: true,
    summary: {
      item_id: input.itemId,
      bullets,
      model: modelId,
      basis,
      disclaimer: DISCLAIMER,
    },
  };
}
