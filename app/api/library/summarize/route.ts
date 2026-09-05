/**
 * POST /api/library/summarize — AI bullet-point summary of a content item.
 *
 * Body:    { "item_id": "<uuid>" }
 * Success: { item_id, bullets, model, basis, disclaimer }
 *
 * GUARDRAIL: `disclaimer` is always present on a success response, carried
 * from lib/ai/summarize. It is generated health content, so the label travels
 * with the payload rather than depending on a client remembering to render it.
 *
 * Auth: requires a session. Unlike the reactions GET, this is not public —
 * each call costs an upstream model request, so it is gated to signed-in users
 * and rate limited per user on top of that.
 *
 * Not streamed, unlike /api/chat. The response is 3-5 short bullets that a UI
 * shows as a block, so streaming would add client complexity for no benefit,
 * and a non-streamed response lets this route return real HTTP error codes
 * (422 vs 502) instead of failing mid-stream.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions/libraryValidation";
import { summarizeItem } from "@/lib/ai/summarize";
import { extractContent } from "@/lib/chat/extractContent";
import { checkLimit } from "@/lib/chat/rateLimit";

export const dynamic = "force-dynamic";
/** Model call plus a possible content extraction; the chat route budgets 60s too. */
export const maxDuration = 60;

/**
 * Summaries are costlier than chat turns and far less interactive, so they get
 * their own tighter bucket rather than sharing RATE_LIMITS.signedIn.
 */
const SUMMARY_RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 } as const;

/** Below this, stored text isn't worth summarizing — try extraction instead. */
const MIN_GOOD_CONTENT = 500;
/** Extraction is best-effort; a summary from the excerpt beats a timeout. */
const EXTRACTION_BUDGET_MS = 12_000;

const ROW_SELECT =
  "id, title, excerpt, content, extracted_content, external_url, source:rss_sources(name)";

interface ItemRow {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  extracted_content: string | null;
  external_url: string | null;
  source: { name?: string } | { name?: string }[] | null;
}

/** Supabase returns a nested one-to-one join as either an object or an array. */
function extractSourceName(
  src: { name?: string } | { name?: string }[] | null
): string | null {
  if (!src) return null;
  return Array.isArray(src) ? src[0]?.name ?? null : src.name ?? null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to generate summaries" },
      { status: 401 }
    );
  }

  const limit = checkLimit(`summarize:${user.id}`, SUMMARY_RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: { item_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isUuid(body.item_id)) {
    return NextResponse.json(
      { error: "item_id is required and must be a UUID" },
      { status: 400 }
    );
  }

  const itemId = body.item_id;
  const supabase = await createClient();

  const { data: row, error: rowError } = await supabase
    .from("rss_items")
    .select(ROW_SELECT)
    .eq("id", itemId)
    .maybeSingle<ItemRow>();

  if (rowError) {
    console.error("[Summarize API] item lookup failed:", rowError);
    return NextResponse.json(
      { error: "Failed to load item" },
      { status: 500 }
    );
  }

  if (!row) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Best available text, cheapest source first — the same ladder the chat route
  // climbs: cached extraction, then the stored feed body, then a live fetch.
  let content: string | null = null;

  if (
    row.extracted_content &&
    row.extracted_content.length >= MIN_GOOD_CONTENT
  ) {
    content = row.extracted_content;
  } else if (row.content && row.content.length >= MIN_GOOD_CONTENT) {
    content = row.content;
  } else if (row.external_url) {
    const extracted = await withTimeout(
      extractContent(row.external_url),
      EXTRACTION_BUDGET_MS
    );
    if (extracted) {
      content = extracted.text;
      // Cache it so the next summary or chat turn skips the fetch. Fire and
      // forget: a failed cache write must not fail the summary.
      void supabase
        .from("rss_items")
        .update({
          extracted_content: extracted.text,
          extracted_at: new Date().toISOString(),
        })
        .eq("id", row.id);
    }
  }

  const outcome = await summarizeItem({
    itemId: row.id,
    title: row.title,
    excerpt: row.excerpt,
    content,
    sourceName: extractSourceName(row.source),
  });

  if (!outcome.ok) {
    // 422: the item is real but has nothing summarizable — a permanent
    // condition for this item, so a client should not retry.
    // 502: the upstream model failed or returned unusable output — transient.
    const status = outcome.code === "insufficient_content" ? 422 : 502;
    return NextResponse.json(
      { error: outcome.error, code: outcome.code },
      { status }
    );
  }

  return NextResponse.json(outcome.summary);
}
