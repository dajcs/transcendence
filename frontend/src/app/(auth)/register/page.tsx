import RegisterForm from "@/components/auth/RegisterForm";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-2xl font-bold dark:text-gray-100">Create Account</h1>
      <RegisterForm />
      <OAuthButtons />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
          Log In
        </Link>
      </p>
      <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </div>
    </div>
  );
}
