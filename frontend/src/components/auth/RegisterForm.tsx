"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

export default function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/api/auth/register", data);
      router.push("/login?registered=1");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Registration failed";
      setError("root", { message: msg });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          {...register("email")}
          type="email"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Username</label>
        <input
          {...register("username")}
          type="text"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
        {errors.username && (
          <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input
          {...register("password")}
          type="password"
          className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 text-sm"
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
