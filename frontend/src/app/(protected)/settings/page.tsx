"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

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
  const queryClient = useQueryClient();
  const router = useRouter();
  const { logout } = useAuthStore();

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
  const [keyPlaceholder, setKeyPlaceholder] = useState("Enter API key");

  useEffect(() => {
    if (!data) return;
    const effectiveMode = (!llmAvailable && data.llm_mode === "default") ? "disabled" : data.llm_mode;
    setMode(effectiveMode);
    setProvider(data.llm_provider ?? "openai");
    setModel(data.llm_model ?? "");
    setKeyPlaceholder(data.llm_api_key_set ? "API key saved — enter new key to replace" : "Enter API key");
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

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const exportData = useMutation({
    mutationFn: async () => {
      const res = await api.get("/api/users/data-export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "voxpopuli-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => (await api.delete("/api/users/account")).data,
    onSuccess: async () => {
      await logout();
      router.push("/");
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings…</p>;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold dark:text-gray-100">Settings</h1>

      {/* AI Features */}
      <section className="rounded border border-gray-200 bg-white p-4 space-y-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold dark:text-gray-100">AI Features</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Controls the thread summarizer and AI resolution suggestion features.
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
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Platform default (free, via OpenRouter)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Uses the platform&apos;s shared key. Subject to daily limits.</p>
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
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Disabled — hide AI features</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Summarize and AI suggestion buttons will not appear.</p>
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
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">My own API key</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Requests go directly to your provider. No daily limits applied.</p>
            </div>
          </label>
        </div>

        {mode === "custom" && (
          <div className="space-y-3 border-t border-gray-100 pt-3 dark:border-slate-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as LlmProvider)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keyPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Stored on the server. Never shared.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gpt-4o-mini, claude-3-haiku-20240307"
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Model name for your provider&apos;s API.</p>
            </div>
          </div>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
        {save.isError   && <p className="text-sm text-red-600 dark:text-red-400">Failed to save.</p>}
        {save.isSuccess && <p className="text-sm text-green-600 dark:text-green-400">Settings saved.</p>}
      </section>

      {/* Privacy & Data */}
      <section className="rounded border border-gray-200 bg-white p-4 space-y-4 dark:border-slate-700 dark:bg-slate-800">
        <h2 className="text-lg font-semibold dark:text-gray-100">Privacy & Data</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your data in accordance with GDPR. See our{" "}
          <a href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</a>.
        </p>

        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">Export your data</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Download a JSON file containing all data associated with your account.
            </p>
            <button
              onClick={() => exportData.mutate()}
              disabled={exportData.isPending}
              className="mt-2 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
            >
              {exportData.isPending ? "Exporting…" : "Download my data"}
            </button>
            {exportData.isError && <p className="mt-1 text-xs text-red-600">Export failed. Please try again.</p>}
          </div>

          <div className="border-t border-gray-100 pt-3 dark:border-slate-700">
            <h3 className="text-sm font-medium text-red-700 dark:text-red-400">Delete account</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Permanently delete your account. Your personal data will be pseudonymized
              and your content will be attributed to a deleted user. This action cannot be undone.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-2 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete my account
              </button>
            ) : (
              <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 space-y-2 dark:border-red-800 dark:bg-red-950">
                <p className="text-sm text-red-800 dark:text-red-300">
                  Are you sure? This will permanently delete your account and pseudonymize all your data.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteAccount.mutate()}
                    disabled={deleteAccount.isPending}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteAccount.isPending ? "Deleting…" : "Yes, delete permanently"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
                {deleteAccount.isError && <p className="text-xs text-red-600">Deletion failed. Please try again.</p>}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
