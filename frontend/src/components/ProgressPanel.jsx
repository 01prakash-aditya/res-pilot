import React, { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, XCircle, Zap } from "lucide-react";

const STEPS = [
  { label: "Extracting text from PDF",       threshold: 10 },
  { label: "Generating AI summary",           threshold: 30 },
  { label: "Building semantic search index",  threshold: 70 },
  { label: "Saving to disk",                  threshold: 90 },
  { label: "Complete",                        threshold: 100 },
];

/**
 * SSE-powered real-time upload progress panel.
 * Connects to /api/progress/{docId} and renders animated step indicators.
 */
export default function ProgressPanel({ docId, onComplete, onError }) {
  const [progress, setProgress] = useState({ step: "Queued", pct: 0, status: "processing" });

  useEffect(() => {
    if (!docId) return;

    const url = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/api/progress/${docId}`;
    const apiKey = import.meta.env.VITE_API_KEY || "";
    const sse = new EventSource(apiKey ? `${url}?api_key=${apiKey}` : url);

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.heartbeat) return;
        setProgress(data);
        if (data.status === "completed") { onComplete?.(); sse.close(); }
        if (data.status === "failed")    { onError?.(data.error); sse.close(); }
      } catch (err) {
        console.error(err);
      }
    };

    sse.onerror = () => sse.close();
    return () => sse.close();
  }, [docId, onComplete, onError]);

  const isFailed = progress.status === "failed";

  return (
    <div className="progress-panel glass-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="empty-icon" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Zap size={18} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: "var(--text-1)" }}>
            {isFailed ? "Processing Failed" : progress.status === "completed" ? "Processing Complete!" : "Processing Document…"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            {isFailed ? progress.error : progress.step}
          </p>
        </div>
        <span className="ml-auto text-sm font-bold" style={{ color: "var(--accent)" }}>
          {progress.pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="progress-track mb-5">
        <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
      </div>

      {/* Step list */}
      <div className="flex flex-col gap-1">
        {STEPS.map((step, i) => {
          const done    = progress.pct >= step.threshold;
          const active  = !done && progress.pct >= (STEPS[i - 1]?.threshold ?? 0);
          const failed  = isFailed && active;

          return (
            <div key={step.label} className={`step-row ${done ? "done" : active ? "active" : ""} ${failed ? "err" : ""}`}>
              {failed ? (
                <XCircle size={15} />
              ) : done ? (
                <CheckCircle2 size={15} />
              ) : active ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Circle size={15} style={{ opacity: 0.35 }} />
              )}
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
