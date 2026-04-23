"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { getMarketPath } from "@/lib/markets";
import { useAuthStore } from "@/store/auth";
import { useT } from "@/i18n";

type UIMarketType = "binary" | "multiple_choice" | "numeric" | "weather";
type WeatherCondition = "rain" | "snow" | "temperature" | "wind";

const WEATHER_BACKEND_TYPE: Record<WeatherCondition, "binary" | "numeric"> = {
  rain: "binary",
  snow: "binary",
  temperature: "numeric",
  wind: "numeric",
};

const WEATHER_RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: -50, max: 60 },
  wind: { min: 0, max: 220 },
};

function buildWeatherAutofill(condition: WeatherCondition, city: string, deadline: string) {
  const c = city.trim() || "…";
  const [datePart, timePart] = deadline.split("T");
  const d = datePart && timePart ? `${datePart} at ${timePart}` : datePart || "…";
  switch (condition) {
    case "rain":
      return {
        title: `Will it rain in ${c} on ${d}?`,
        description: `Weather prediction for ${c} on ${d}. Auto-resolved at deadline via Open-Meteo.`,
        resolutionCriteria: `Resolves YES if rain > 0.1 mm at deadline, NO otherwise. Resolved automatically via Open-Meteo.`,
      };
    case "snow":
      return {
        title: `Will it snow in ${c} on ${d}?`,
        description: `Weather prediction for ${c} on ${d}. Auto-resolved at deadline via Open-Meteo.`,
        resolutionCriteria: `Resolves YES if snowfall > 0.1 cm at deadline, NO otherwise. Resolved automatically via Open-Meteo.`,
      };
    case "temperature":
      return {
        title: `What will the temperature be in ${c} on ${d}?`,
        description: `Predict the temperature (°C) in ${c} at the market deadline. Range: −50 to +60 °C.`,
        resolutionCriteria: `Resolves to the actual temperature (°C) at deadline via Open-Meteo. Closest prediction wins.`,
      };
    case "wind":
      return {
        title: `What will the wind speed be in ${c} on ${d}?`,
        description: `Predict the wind speed (km/h) in ${c} at the market deadline. Range: 0 to 220 km/h.`,
        resolutionCriteria: `Resolves to the actual wind speed (km/h) at deadline via Open-Meteo. Closest prediction wins.`,
      };
  }
}

export default function NewMarketPage() {
  const router = useRouter();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const t = useT();

  const [marketType, setMarketType] = useState<UIMarketType>("binary");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [deadline, setDeadline] = useState("");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [numericMin, setNumericMin] = useState("");
  const [numericMax, setNumericMax] = useState("");
  const [weatherCity, setWeatherCity] = useState("");
  const [weatherCondition, setWeatherCondition] = useState<WeatherCondition>("rain");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill title/description/criteria when weather parameters change
  useEffect(() => {
    if (marketType !== "weather") return;
    const fill = buildWeatherAutofill(weatherCondition, weatherCity, deadline);
    setTitle(fill.title);
    setDescription(fill.description);
    setResolutionCriteria(fill.resolutionCriteria);
    if (weatherCondition === "temperature") {
      setNumericMin("-50");
      setNumericMax("60");
    } else if (weatherCondition === "wind") {
      setNumericMin("0");
      setNumericMax("220");
    }
  }, [marketType, weatherCondition, weatherCity, deadline]);

  const updateChoice = (index: number, value: string) =>
    setChoices((prev) => prev.map((c, i) => (i === index ? value : c)));
  const addChoice = () => { if (choices.length < 10) setChoices((prev) => [...prev, ""]); };
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
      };

      if (marketType === "weather") {
        const backendType = WEATHER_BACKEND_TYPE[weatherCondition];
        payload.market_type = backendType;
        payload.resolution_source = {
          provider: "open-meteo",
          location: weatherCity.trim(),
          condition: weatherCondition,
        };
        if (backendType === "numeric") {
          const range = WEATHER_RANGES[weatherCondition];
          payload.numeric_min = range.min;
          payload.numeric_max = range.max;
        }
      } else {
        payload.market_type = marketType;
        if (marketType === "multiple_choice") {
          payload.choices = choices.filter((c) => c.trim());
        }
        if (marketType === "numeric") {
          payload.numeric_min = parseFloat(numericMin);
          payload.numeric_max = parseFloat(numericMax);
        }
      }

      const response = await api.post("/api/markets", payload);
      await bootstrap();
      router.push(getMarketPath(response.data.id, title));
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(t("create.error_create"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100";
  const btnCls = (active: boolean) =>
    `rounded px-3 py-1 text-sm ${active ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`;

  const deadlineDate = deadline.split("T")[0] ?? "";
  const deadlineTime = deadline.split("T")[1] ?? "12:00";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("create.page_title")}</h1>

      <form
        className="space-y-4 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
        onSubmit={onSubmit}
      >
        {/* Market Type */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("create.market_type")}</label>
          <div className="flex flex-wrap gap-2">
            {(["binary", "multiple_choice", "numeric", "weather"] as const).map((mt) => (
              <button
                key={mt}
                type="button"
                onClick={() => setMarketType(mt)}
                className={btnCls(marketType === mt)}
              >
                {mt === "binary"
                  ? t("create.yes_no")
                  : mt === "multiple_choice"
                  ? t("create.multiple_choice")
                  : mt === "numeric"
                  ? t("create.numeric")
                  : t("create.weather")}
              </button>
            ))}
          </div>
        </div>

        {/* Weather fields */}
        {marketType === "weather" && (
          <div className="rounded border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/20 p-3 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("create.city")}</label>
              <input
                required
                type="text"
                placeholder="Paris"
                value={weatherCity}
                onChange={(e) => setWeatherCity(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("create.city_hint")}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("create.condition")}</label>
              <select
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value as WeatherCondition)}
                className={inputCls}
              >
                <option value="rain">{t("create.condition_rain")}</option>
                <option value="snow">{t("create.condition_snow")}</option>
                <option value="temperature">{t("create.condition_temperature")}</option>
                <option value="wind">{t("create.condition_wind")}</option>
              </select>
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-400">{t("create.weather_info")}</p>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("create.field_title")}</label>
          <input
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("create.description")}</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Resolution Criteria */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("create.resolution_criteria")}</label>
          <textarea
            required
            rows={2}
            value={resolutionCriteria}
            onChange={(e) => setResolutionCriteria(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Deadline */}
        <div className="space-y-1">
          <label className="text-sm font-medium">{t("create.deadline")}</label>
          <div className="flex gap-2">
            <div className="flex-1 space-y-0.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t("create.date")}</label>
              <input
                required
                type="date"
                value={deadlineDate}
                onChange={(e) => setDeadline(`${e.target.value}T${deadlineTime}`)}
                className={inputCls}
              />
            </div>
            <div className="flex-1 space-y-0.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t("create.time")}</label>
              <input
                required
                type="time"
                value={deadlineTime}
                onChange={(e) => setDeadline(`${deadlineDate}T${e.target.value}`)}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Multiple choice options */}
        {marketType === "multiple_choice" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("create.choices_label")}</label>
            {choices.map((choice, i) => (
              <div key={i} className="flex gap-2">
                <input
                  required
                  value={choice}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  placeholder={t("create.choice_placeholder", { n: i + 1 })}
                  className="flex-1 rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                {choices.length > 2 && (
                  <button type="button" onClick={() => removeChoice(i)} className="text-sm text-red-500 hover:underline">
                    {t("create.remove")}
                  </button>
                )}
              </div>
            ))}
            {choices.length < 10 && (
              <button type="button" onClick={addChoice} className="text-sm text-blue-600 hover:underline">
                {t("create.add_choice")}
              </button>
            )}
          </div>
        )}

        {/* Numeric range */}
        {marketType === "numeric" && (
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{t("create.min")}</label>
              <input required type="number" value={numericMin} onChange={(e) => setNumericMin(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium">{t("create.max")}</label>
              <input required type="number" value={numericMax} onChange={(e) => setNumericMax(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? t("create.creating") : t("create.submit")}
        </button>
      </form>
    </div>
  );
}
