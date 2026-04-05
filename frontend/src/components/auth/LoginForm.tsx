"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

const schema = z.object({
  identifier: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

function normalizeLoginError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (first && typeof first.msg === "string") {
      return first.msg;
    }
    return "Login failed";
  }

  if (detail && typeof detail === "object") {
    const maybeMsg = (detail as { msg?: unknown }).msg;
    if (typeof maybeMsg === "string") {
      return maybeMsg;
    }
  }

  return "Login failed";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const bootstrap = useAuthStore((s) => s.bootstrap);
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
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = normalizeLoginError(err);
      setError("root", { message: msg });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      {oauthError && (
        <p className="text-red-500 text-sm rounded border border-red-200 bg-red-50 px-3 py-2">
          {oauthError}
        </p>
      )}
      <div>
        {/* <label className="block text-sm font-medium text-gray-700">Email or Username + Password</label> */}
        <input
          {...register("identifier")}
          type="text"
          placeholder="Email or Username"
          autoComplete="username"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.identifier && <p className="text-red-500 text-xs mt-1">{errors.identifier.message}</p>}
      </div>
      <div>
        {/* <label className="block text-sm font-medium text-gray-700">Password</label> */}
        <input
          {...register("password")}
          type="password"
          placeholder="Password"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
      </div>
      {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Logging in..." : "Log In"}
      </button>
    </form>
  );
}
