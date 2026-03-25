"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type MarketType = "binary" | "multiple_choice" | "numeric";

export default function NewMarketPage() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [deadline, setDeadline] = useState("");
  const [marketType, setMarketType] = useState<MarketType>("binary");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [numericMin, setNumericMin] = useState("");
  const [numericMax, setNumericMax] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateChoice = (index: number, value: string) => {
    setChoices((prev) => prev.map((c, i) => (i === index ? value : c)));
  };

  const addChoice = () => {
    if (choices.length < 10) setChoices((prev) => [...prev, ""]);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 2) setChoices((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title,
        description,
        resolution_criteria: resolutionCriteria,
        deadline: new Date(deadline).toISOString(),
        market_type: marketType,
      };
      if (marketType === "multiple_choice") {
        payload.choices = choices.filter((c) => c.trim());
      }
      if (marketType === "numeric") {
        payload.numeric_min = parseFloat(numericMin);
        payload.numeric_max = parseFloat(numericMax);
      }
      const response = await api.post("/api/markets", payload);
      await bootstrap();
      router.push(`/markets/${response.data.id}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Failed to create market.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create Market</h1>
      <p className="text-sm text-gray-600">Creating a market costs 1 BP.</p>

      <form className="space-y-3 rounded border border-gray-200 bg-white p-4" onSubmit={onSubmit}>
        <div className="space-y-1">
          <label className="text-sm font-medium">Title</label>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Resolution Criteria</label>
          <textarea
            required
            value={resolutionCriteria}
            onChange={(e) => setResolutionCriteria(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Deadline</label>
          <input
            required
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Market Type</label>
          <div className="flex gap-2">
            {(["binary", "multiple_choice", "numeric"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMarketType(t)}
                className={`rounded px-3 py-1 text-sm ${marketType === t ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                {t === "binary" ? "Yes/No" : t === "multiple_choice" ? "Multiple Choice" : "Numeric"}
              </button>
            ))}
          </div>
        </div>

        {marketType === "multiple_choice" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Choices (2–10)</label>
            {choices.map((choice, i) => (
              <div key={i} className="flex gap-2">
                <input
                  required
                  value={choice}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  placeholder={`Choice ${i + 1}`}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                />
                {choices.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeChoice(i)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {choices.length < 10 && (
              <button
                type="button"
                onClick={addChoice}
                className="text-sm text-blue-600 hover:underline"
              >
                + Add choice
              </button>
            )}
          </div>
        )}

        {marketType === "numeric" && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Min</label>
              <input
                required
                type="number"
                value={numericMin}
                onChange={(e) => setNumericMin(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">Max</label>
              <input
                required
                type="number"
                value={numericMax}
                onChange={(e) => setNumericMax(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Market"}
        </button>
      </form>
    </div>
  );
}
