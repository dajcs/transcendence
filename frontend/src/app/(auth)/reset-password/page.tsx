import ResetForm from "@/components/auth/ResetForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center gap-6 pt-12">
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <p className="text-sm text-gray-600 max-w-sm text-center">
        Enter your email and we'll send you a reset link.
      </p>
      <ResetForm />
    </div>
  );
}
