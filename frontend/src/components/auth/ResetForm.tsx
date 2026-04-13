"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/i18n";

const schema = z.object({ email: z.string().email("Invalid email") });
type FormData = z.infer<typeof schema>;

export default function ResetForm() {
  const t = useT();
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    await api.post("/api/auth/reset-request", data).catch(() => {});
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t("auth.reset_sent")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("auth.email")}</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message === "Invalid email" ? t("auth.validation_invalid_email" as any) : errors.email.message}</p>}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? t("auth.sending") : t("auth.send_reset")}
      </button>
    </form>
  );
}
