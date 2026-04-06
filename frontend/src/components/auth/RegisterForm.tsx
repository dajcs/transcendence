"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

function normalizeRegisterError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") {
      return first.msg;
    }
    return "Registration failed";
  }

  if (detail && typeof detail === "object") {
    const maybeMsg = (detail as { msg?: unknown }).msg;
    if (typeof maybeMsg === "string") {
      return maybeMsg;
    }
  }

  return "Registration failed";
}

export default function RegisterForm() {
  const router = useRouter();
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
      const msg = normalizeRegisterError(err);
      setError("root", { message: msg });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
        <input
          {...register("username")}
          type="text"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
        />
        {errors.username && (
          <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
        <input
          {...register("password")}
          type="password"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100"
        />
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>
      {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Registering..." : "Create Account"}
      </button>
    </form>
  );
}
