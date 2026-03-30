"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/api/users/me")).data,
  });

  const [llmOptOut, setLlmOptOut] = useState<boolean>(profileQuery.data?.llm_opt_out ?? false);

  const updateSettings = useMutation({
    mutationFn: async (updates: { llm_opt_out: boolean }) =>
      (await api.patch("/api/users/me", updates)).data,
    onSuccess: async () => {
      await bootstrap();
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const handleToggle = () => {
    const newValue = !llmOptOut;
    setLlmOptOut(newValue);
    updateSettings.mutate({ llm_opt_out: newValue });
  };

  if (profileQuery.isLoading) return <p className="text-sm text-gray-500">Loading settings...</p>;

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="rounded border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold">AI Features</h2>
        <p className="text-sm text-gray-600">
          When enabled, AI can summarize discussions and suggest bet resolutions.
          Your bet content may be processed by a third-party AI service (OpenRouter).
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!llmOptOut}
            onChange={handleToggle}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-800">Enable AI features</span>
        </label>
        {updateSettings.isError && (
          <p className="text-sm text-red-600">Failed to save settings.</p>
        )}
        {updateSettings.isSuccess && (
          <p className="text-sm text-green-600">Settings saved.</p>
        )}
      </section>
    </div>
  );
}
