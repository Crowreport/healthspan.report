"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import styles from "./page.module.css";
import { useChatStore } from "@/store/useChatStore";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

type Biomarkers = {
  age: number | "";
  glucose: number | "";
  vo2_max: number | "";
  sleep_hours: number | "";
  workout_freq: number | "";
};

const EMPTY: Biomarkers = {
  age: "",
  glucose: "",
  vo2_max: "",
  sleep_hours: "",
  workout_freq: "",
};

function normalize(value: number | "", min: number, max: number): number {
  if (value === "") return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [biomarkers, setBiomarkers] = useState<Biomarkers>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  type Insight = { title: string; insight: string };
const [insights, setInsights] = useState<Insight[]>([]);
const [loadingInsights, setLoadingInsights] = useState(false);
const openChat = useChatStore((s) => s.open);
const setPendingPrompt = useChatStore((s) => s.setPendingPrompt);


  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("users")
        .select("age, glucose, vo2_max, sleep_hours, workout_freq")
        .eq("id", user.id)
        .single();

      if (data) {
        setBiomarkers({
          age: data.age ?? "",
          glucose: data.glucose ?? "",
          vo2_max: data.vo2_max ?? "",
          sleep_hours: data.sleep_hours ?? "",
          workout_freq: data.workout_freq ?? "",
        });
      }
      setLoading(false);
    }
    void load();
  }, []);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({
        age: biomarkers.age === "" ? null : biomarkers.age,
        glucose: biomarkers.glucose === "" ? null : biomarkers.glucose,
        vo2_max: biomarkers.vo2_max === "" ? null : biomarkers.vo2_max,
        sleep_hours: biomarkers.sleep_hours === "" ? null : biomarkers.sleep_hours,
        workout_freq: biomarkers.workout_freq === "" ? null : biomarkers.workout_freq,
      })
      .eq("id", userId);

    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }
  function handleAskChat(question: string) {
    setPendingPrompt({ text: question });
   openChat();
  }
  // Normalize each biomarker to a 0–100 scale for the chart
  const chartData = {
    labels: ["Sleep", "VO2 Max", "Glucose", "Workout Freq", "Age Score"],
    datasets: [
      {
        label: "Your Health Profile",
        data: [
          normalize(biomarkers.sleep_hours, 0, 10),        // 10h = max
          normalize(biomarkers.vo2_max, 20, 60),           // 60 = elite
          100 - normalize(biomarkers.glucose, 70, 140),    // lower is better
          normalize(biomarkers.workout_freq, 0, 7),        // 7 days = max
          100 - normalize(biomarkers.age, 20, 80),         // younger = higher score
        ],
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        borderColor: "rgba(37, 99, 235, 0.8)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(37, 99, 235, 1)",
      },
    ],
  };

  const chartOptions = {
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: { display: false },
        grid: { color: "rgba(0,0,0,0.08)" },
        pointLabels: { font: { size: 13 } },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const fields: { key: keyof Biomarkers; label: string; unit: string; min: number; max: number; step: number }[] = [
    { key: "age", label: "Age", unit: "years", min: 10, max: 100, step: 1 },
    { key: "glucose", label: "Glucose", unit: "mg/dL", min: 50, max: 200, step: 1 },
    { key: "vo2_max", label: "VO2 Max", unit: "mL/kg/min", min: 10, max: 80, step: 0.1 },
    { key: "sleep_hours", label: "Sleep", unit: "hrs/night", min: 0, max: 12, step: 0.5 },
    { key: "workout_freq", label: "Workout Frequency", unit: "days/week", min: 0, max: 7, step: 1 },
  ];

  const hasData = Object.values(biomarkers).some((v) => v !== "");


  async function handleGenerateInsights() {
  setLoadingInsights(true);
  const res = await fetch("/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(biomarkers),
  });
  const { insights } = await res.json();
  setInsights(insights);
  setLoadingInsights(false);
}
  function getSuggestions(title: string, insight: string): string[] {
  const combined = `${title}: ${insight}`.toLowerCase();

  if (combined.includes("sleep")) return [
    "What are the health risks of poor sleep?",
    "What habits improve sleep quality?",
    "How does sleep affect longevity?",
  ];
  if (combined.includes("glucose") || combined.includes("blood sugar")) return [
    "What are the dangers of high glucose levels?",
    "How can I lower my blood glucose naturally?",
    "What foods spike blood sugar the most?",
  ];
  if (combined.includes("vo2") || combined.includes("cardio") || combined.includes("cardiovascular")) return [
    "What is VO2 max and why does it matter?",
    "How can I improve my VO2 max?",
    "What cardio exercises are best for longevity?",
  ];
  if (combined.includes("workout") || combined.includes("exercise") || combined.includes("muscle")) return [
    "How much exercise is optimal for longevity?",
    "What are the benefits of strength training?",
    "How does exercise frequency affect healthspan?",
  ];

  // Generic fallback
  return [
    `Tell me more about ${title.toLowerCase()}`,
    "How does this affect my longevity?",
    "What lifestyle changes can help?",
  ];
}
  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.heading}>Health IQ Dashboard</h1>
          <p className={styles.subheading}>Enter your biomarkers to visualise your health profile.</p>

          {loading ? <p>Loading…</p> : (
            <div className={styles.layout}>

              {/* Biomarker form */}
              <section className={styles.formSection}>
                <h2 className={styles.sectionTitle}>Your Biomarkers</h2>
                <div className={styles.fields}>
                  {fields.map(({ key, label, unit, min, max, step }) => (
                    <div key={key} className={styles.field}>
                      <label className={styles.label}>
                        {label}
                        <span className={styles.unit}>{unit}</span>
                      </label>
                      <input
                        type="number"
                        className={styles.input}
                        value={biomarkers[key]}
                        min={min}
                        max={max}
                        step={step}
                        placeholder="—"
                        onChange={(e) =>
                          setBiomarkers((prev) => ({
                            ...prev,
                            [key]: e.target.value === "" ? "" : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  className={styles.saveButton}
                  onClick={() => void handleSave()}
                  disabled={saving || saved}
                >
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save Biomarkers"}
                </button>
              </section>

              {/* Radar chart */}
              <section className={styles.chartSection}>
                <h2 className={styles.sectionTitle}>Health Radar</h2>
                {hasData ? (
                  <div className={styles.chartWrap}>
                    <Radar data={chartData} options={chartOptions} />
                  </div>
                ) : (
                  <div className={styles.chartEmpty}>
                    Fill in your biomarkers to see your health radar.
                  </div>
                )}
              </section>

            </div>
          )}

          <section className={styles.insightsSection}>
  <h2 className={styles.sectionTitle}>AI Insights</h2>
  <p className={styles.insightsDisclaimer}>
    This is not medical advice. Always consult your physician.
  </p>
  <button
    className={styles.saveButton}
    onClick={() => void handleGenerateInsights()}
    disabled={loadingInsights || !hasData}
    style={{ marginBottom: "1.25rem", maxWidth: 220 }}
  >
    {loadingInsights ? "Generating…" : "Generate Insights"}
  </button>

  {insights.length > 0 && (
  <div className={styles.insightsGrid}>
    {insights.map((item, i) => (
      <div key={i} className={styles.insightCard}>
        <h3 className={styles.insightTitle}>{item.title}</h3>
        <p className={styles.insightText}>{item.insight}</p>
        <div className={styles.suggestions}>
          {getSuggestions(item.title, item.insight).map((q) => (
            <button
              key={q}
              type="button"
              className={styles.suggestionButton}
              onClick={() => handleAskChat(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
)}

  {!loadingInsights && insights.length === 0 && hasData && (
    <p className={styles.insightsPlaceholder}>
      Click Generate Insights to see your personalised health analysis.
    </p>
  )}

  {!hasData && (
    <p className={styles.insightsPlaceholder}>
      Fill in your biomarkers above first.
    </p>
  )}
</section>

        </div>
      </main>
      <Footer />
    </>
  );
}