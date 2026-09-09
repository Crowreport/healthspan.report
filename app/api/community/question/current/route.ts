/**
 * GET /api/community/question/current — the active community question.
 *
 * Response: { question, response_count, user_response }
 *
 * Public: anonymous visitors see the prompt and the participation count, and
 * `user_response` is null for them. Signing in is only required to answer.
 *
 * Returns 200 with `question: null` when nothing is scheduled for right now.
 * That is a normal state between questions, not a missing resource, so a 404
 * would make a client treat an ordinary gap as an error.
 */

import { NextResponse } from "next/server";
import { getCurrentQuestion } from "@/lib/actions/community";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCurrentQuestion();

  if (result.error || !result.data) {
    console.error("[Community API] current question failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to fetch current question" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    question: result.data.question,
    response_count: result.data.response_count,
    user_response: result.data.user_response,
  });
}
