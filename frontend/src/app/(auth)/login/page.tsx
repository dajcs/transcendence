import LoginForm from "@/components/auth/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-2xl font-bold">Log In</h1>
      <LoginForm />
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
