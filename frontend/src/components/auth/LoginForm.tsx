"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { useT } from "@/i18n";

const schema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

const VALIDATION_MAP: Record<string, string> = {
  "Email or username is required": "auth.validation_email_required",
  "Password is required": "auth.validation_password_required",
};

function normalizeLoginError(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") {
      return first.msg;
    }
    return null;
  }

  if (detail && typeof detail === "object") {
    const maybeMsg = (detail as { msg?: unknown }).msg;
    if (typeof maybeMsg === "string") {
      return maybeMsg;
    }
  }

  return null;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const t = useT();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/api/auth/login", data);
      await bootstrap();
      router.push("/markets");
    } catch (err: unknown) {
      const msg = normalizeLoginError(err) ?? t("auth.login_failed");
      setError("root", { message: msg });
    }
  };

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      {oauthError && (
        <p className="text-red-500 text-sm rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
          {oauthError}
        </p>
      )}
      <div>
        {/* <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email or Username + Password</label> */}
        <input
          {...register("identifier")}
          type="text"
          placeholder={t("auth.enter_email_or_username")}
          autoComplete="username"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.identifier && <p className="text-red-500 text-xs mt-1">{VALIDATION_MAP[errors.identifier.message!] ? t(VALIDATION_MAP[errors.identifier.message!] as any) : errors.identifier.message}</p>}
      </div>
      <div>
        {/* <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label> */}
        <input
          {...register("password")}
          type="password"
          placeholder={t("auth.password")}
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.password && <p className="text-red-500 text-xs mt-1">{VALIDATION_MAP[errors.password.message!] ? t(VALIDATION_MAP[errors.password.message!] as any) : errors.password.message}</p>}
      </div>
      {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? t("auth.logging_in") : t("auth.login")}
      </button>
    </form>
  );
}
