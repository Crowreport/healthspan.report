import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { age, glucose, vo2_max, sleep_hours, workout_freq } = await req.json();

  const prompt = `
You are a health insights assistant. Based on the following biomarkers, generate exactly 3 short, actionable health insights. 
Return ONLY a JSON array of 3 objects with "title" and "insight" fields. No preamble, no markdown, no explanation.

Biomarkers:
- Age: ${age ?? "unknown"}
- Glucose: ${glucose ?? "unknown"} mg/dL
- VO2 Max: ${vo2_max ?? "unknown"} mL/kg/min
- Sleep: ${sleep_hours ?? "unknown"} hours/night
- Workout frequency: ${workout_freq ?? "unknown"} days/week

Rules:
- Keep each insight under 40 words
- Be specific to the numbers provided
- Never give medical advice
- End every insight with: "Consult your physician."

Example format:
[
  { "title": "Sleep Recovery", "insight": "Your sleep is below optimal. Aim for 7-9 hours. Consult your physician." },
  { "title": "Glucose levels", "insight": "Your glucose is in a healthy range. Maintain a low-sugar diet. Consult your physician." },
  { "title": "Cardiovascular Fitness", "insight": "Your VO2 max suggests room for improvement. Try zone 2 cardio 3x per week. Consult your physician." }
]
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content ?? "[]";

  try {
    const insights = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: [] }, { status: 500 });
  }
}