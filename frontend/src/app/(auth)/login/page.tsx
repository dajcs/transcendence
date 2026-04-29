"use client";

import { Suspense } from "react";
import LoginForm from "@/components/auth/LoginForm";
import OAuthButtons from "@/components/auth/OAuthButtons";
import Link from "next/link";
import { useT } from "@/i18n";

export default function LoginPage() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-6 pt-4 md:pt-12">
      <h1 className="text-2xl font-bold">{t("auth.login")}</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <OAuthButtons />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t("auth.no_account")}{" "}
        <Link href="/register" className="text-blue-600 hover:underline dark:text-blue-400">
          {t("auth.register_link")}
        </Link>
      </p>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <Link href="/reset-password" className="text-blue-600 hover:underline dark:text-blue-400">
          {t("auth.forgot_password")}
        </Link>
      </p>
    </div>
  );
}
