"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type LlmMode = "default" | "disabled" | "custom";
type LlmProvider = "anthropic" | "openai" | "gemini" | "grok";

interface LlmSettings {
  llm_mode: LlmMode;
  llm_provider: LlmProvider | null;
  llm_api_key_set: boolean;
}

const PROVIDERS: { id: LlmProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "openai",    label: "OpenAI (GPT)" },
  { id: "gemini",    label: "Google Gemini" },
  { id: "grok",      label: "xAI Grok" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<LlmSettings>({
    queryKey: ["llm-settings"],
    queryFn: async () => (await api.get("/api/users/me")).data,
  });

  const [mode, setMode] = useState<LlmMode>("default");
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [keyPlaceholder, setKeyPlaceholder] = useState("Enter API key");

  useEffect(() => {
    if (!data) return;
    setMode(data.llm_mode);
    setProvider(data.llm_provider ?? "openai");
    setKeyPlaceholder(data.llm_api_key_set ? "API key saved — enter new key to replace" : "Enter API key");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { llm_mode: mode };
      if (mode === "custom") {
        body.llm_provider = provider;
        if (apiKey) body.llm_api_key = apiKey;
      }
      return (await api.patch("/api/users/me", body)).data;
    },
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["llm-settings"] });
    },
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading settings…</p>;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold">AI Features</h2>
        <p className="text-sm text-gray-500">
          Controls the thread summarizer and AI resolution suggestion features.
        </p>

        <div className="space-y-2">
          {(["default", "custom", "disabled"] as LlmMode[]).map((m) => (
            <label key={m} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="llm_mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {m === "default"  && "Platform default (free, via OpenRouter)"}
                  {m === "custom"   && "My own API key"}
                  {m === "disabled" && "Disabled — hide AI features"}
                </p>
                <p className="text-xs text-gray-500">
                  {m === "default"  && "Uses the platform's shared key. Subject to daily limits."}
                  {m === "custom"   && "Requests go directly to your provider. No daily limits applied."}
                  {m === "disabled" && "Summarize and AI suggestion buttons will not appear."}
                </p>
              </div>
            </label>
          ))}
        </div>

        {mode === "custom" && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as LlmProvider)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={keyPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-gray-400">Stored on the server. Never shared.</p>
            </div>
          </div>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save settings"}
        </button>
        {save.isError  && <p className="text-sm text-red-600">Failed to save.</p>}
        {save.isSuccess && <p className="text-sm text-green-600">Settings saved.</p>}
      </section>
    </div>
  );
}
