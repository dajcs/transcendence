import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-2xl font-bold">Log In</h1>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Email or username + password</h2>
      <Suspense>
        <LoginForm />
      </Suspense>
      <OAuthButtons />
      <p className="text-sm text-gray-600">
        No account?{" "}
        <Link href="/register" className="text-blue-600 hover:underline">
          Register
        </Link>
      </p>
      <p className="text-sm text-gray-600">
        <Link href="/reset-password" className="text-blue-600 hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
