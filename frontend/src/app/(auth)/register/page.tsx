import RegisterForm from "@/components/auth/RegisterForm";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-2xl font-bold">Create Account</h1>
      <RegisterForm />
      <p className="text-sm text-gray-600">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Log In
        </Link>
      </p>
    </div>
  );
}
