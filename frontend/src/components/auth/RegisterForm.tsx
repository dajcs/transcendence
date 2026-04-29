"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useT } from "@/i18n";

const schema = z.object({
  email: z.string().email("Invalid email"),
  username: z.string().min(3, "Min 3 chars").max(32, "Max 32 chars"),
  password: z
    .string()
    .min(8, "Min 8 chars")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain a digit"),
});

type FormData = z.infer<typeof schema>;

const VALIDATION_MAP: Record<string, { key: string; params?: Record<string, string | number> }> = {
  "Invalid email": { key: "auth.validation_invalid_email" },
  "Min 3 chars": { key: "auth.validation_min_chars", params: { n: 3 } },
  "Max 32 chars": { key: "auth.validation_max_chars", params: { n: 32 } },
  "Min 8 chars": { key: "auth.validation_min_chars", params: { n: 8 } },
  "Must contain uppercase": { key: "auth.validation_need_uppercase" },
  "Must contain a digit": { key: "auth.validation_need_digit" },
};

function normalizeRegisterError(err: unknown): string | null {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") {
      return first.msg;
    }
    return null; // will use t() fallback
  }

  if (detail && typeof detail === "object") {
    const maybeMsg = (detail as { msg?: unknown }).msg;
    if (typeof maybeMsg === "string") {
      return maybeMsg;
    }
  }

  return null;
}

function translateValidation(msg: string | undefined, t: ReturnType<typeof useT>): string {
  if (!msg) return "";
  const entry = VALIDATION_MAP[msg];
  return entry ? t(entry.key as any, entry.params) : msg;
}

export default function RegisterForm() {
  const router = useRouter();
  const t = useT();
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    clearErrors();

    const validation = schema.safeParse(data);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (field === "email" || field === "username" || field === "password") {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    try {
      await api.post("/api/auth/register", data);
      router.push("/login?registered=1");
    } catch (err: unknown) {
      const msg = normalizeRegisterError(err) ?? t("auth.registration_failed");
      setError("root", { message: msg });
    }
  };

  return (
    <form method="post" noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("auth.email")}
        </label>
        <input
          {...register("email")}
          id="register-email"
          type="email"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{translateValidation(errors.email.message, t)}</p>}
      </div>
      <div>
        <label htmlFor="register-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("auth.username")}
        </label>
        <input
          {...register("username")}
          id="register-username"
          type="text"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.username && (
          <p className="text-red-500 text-xs mt-1">{translateValidation(errors.username.message, t)}</p>
        )}
      </div>
      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("auth.password")}
        </label>
        <input
          {...register("password")}
          id="register-password"
          type="password"
          className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{translateValidation(errors.password.message, t)}</p>
        )}
      </div>
      {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? t("auth.registering") : t("auth.register")}
      </button>
    </form>
  );
}
