"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n";
import { useLocaleStore, type Locale } from "@/store/locale";

type LlmMode = "default" | "disabled" | "custom";
type LlmProvider = "anthropic" | "openai" | "gemini" | "grok" | "openrouter";

interface LlmSettings {
  llm_mode: LlmMode;
  llm_provider: LlmProvider | null;
  llm_model: string | null;
  llm_api_key_set: boolean;
}

const PROVIDERS: { id: LlmProvider; label: string }[] = [
  { id: "openrouter", label: "OpenRouter (multi-model)" },
  { id: "openai",     label: "OpenAI (GPT)" },
  { id: "anthropic",  label: "Anthropic (Claude)" },
  { id: "gemini",     label: "Google Gemini" },
  { id: "grok",       label: "xAI Grok" },
];

export default function SettingsPage() {
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const queryClient = useQueryClient();

  const { data: availData } = useQuery<{ available: boolean }>({
    queryKey: ["llm-available"],
    queryFn: async () => (await api.get("/api/config/llm-available")).data,
  });
  const llmAvailable = availData?.available ?? false;

  const { data, isLoading } = useQuery<LlmSettings>({
    queryKey: ["llm-settings"],
    queryFn: async () => (await api.get("/api/users/me")).data,
  });

  const [mode, setMode] = useState<LlmMode>("disabled");
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [keySet, setKeySet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    // If platform key unavailable and mode was "default", switch to "disabled"
    const effectiveMode = (!llmAvailable && data.llm_mode === "default") ? "disabled" : data.llm_mode;
    setMode(effectiveMode);
    setProvider(data.llm_provider ?? "openai");
    setModel(data.llm_model ?? "");
    setKeySet(data.llm_api_key_set);
  }, [data, llmAvailable]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { llm_mode: mode };
      if (mode === "custom") {
        body.llm_provider = provider;
        if (apiKey) body.llm_api_key = apiKey;
        body.llm_model = model;
      }
      return (await api.patch("/api/users/me", body)).data;
    },
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["llm-settings"] });
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t("common.loading")}</p>;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

      {/* Language */}
      <section className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.language")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings.language_description")}</p>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1.5 text-sm"
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </section>

      <section className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.ai_features")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("settings.ai_description")}
        </p>

        <div className="space-y-2">
          {llmAvailable && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="llm_mode"
                value="default"
                checked={mode === "default"}
                onChange={() => setMode("default")}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("settings.platform_default")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.platform_default_desc")}</p>
              </div>
            </label>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="llm_mode"
              value="disabled"
              checked={mode === "disabled"}
              onChange={() => setMode("disabled")}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("settings.disabled")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.disabled_desc")}</p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="llm_mode"
              value="custom"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("settings.custom_key")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings.custom_key_desc")}</p>
            </div>
          </label>
        </div>

        {mode === "custom" && (
          <div className="space-y-3 border-t border-gray-100 dark:border-gray-700 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settings.provider")}</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as LlmProvider)}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settings.api_key")}</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keySet ? t("settings.api_key_saved") : t("settings.api_key_placeholder")}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t("settings.api_key_note")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settings.model")}</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t("settings.model_placeholder")}
                className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t("settings.model_note")}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:opacity-50"
        >
          {save.isPending ? t("settings.saving") : t("settings.save")}
        </button>
        {save.isError   && <p className="text-sm text-red-600 dark:text-red-400">{t("settings.save_error")}</p>}
        {save.isSuccess && <p className="text-sm text-green-600 dark:text-green-400">{t("settings.save_success")}</p>}
      </section>

      {/* GDPR Section */}
      <section className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
        <h2 className="text-lg font-semibold">{t("settings.gdpr_title")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("settings.gdpr_description")}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              setExporting(true);
              setExportError(null);
              try {
                const { data } = await api.get("/api/users/data-export");
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "vox-populi-data.json";
                a.click();
                URL.revokeObjectURL(url);
              } catch {
                setExportError(t("settings.export_error"));
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? t("settings.exporting") : t("settings.export_data")}
          </button>
          {exportError && (
            <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="rounded border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            {t("settings.delete_account")}
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
            <p className="text-sm text-red-800 dark:text-red-300 font-medium">
              {t("settings.delete_warning")}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={t("settings.delete_confirm")}
              className="w-full rounded border border-red-300 dark:border-red-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 dark:bg-gray-700"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await api.delete("/api/users/account");
                    window.location.href = "/";
                  } catch {
                    setDeleteError(t("settings.delete_error"));
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t("settings.deleting") : t("settings.delete_account")}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300"
              >
                {t("common.cancel")}
              </button>
            </div>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
