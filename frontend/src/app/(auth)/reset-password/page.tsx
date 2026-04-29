"use client";

import ResetForm from "@/components/auth/ResetForm";
import { useT } from "@/i18n";

export default function ResetPasswordPage() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-6 pt-4 md:pt-12">
      <h1 className="text-2xl font-bold dark:text-gray-100">{t("auth.reset_password")}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm text-center">
        {t("auth.reset_subtitle")}
      </p>
      <ResetForm />
    </div>
  );
}
