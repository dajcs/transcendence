"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export default function HomePage() {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">{t("app.name")}</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 max-w-lg">
        {t("home.tagline")}
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {t("home.get_started")}
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
        >
          {t("home.log_in")}
        </Link>
      </div>
      <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
        <Link href="/privacy" className="hover:underline">{t("home.privacy")}</Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">{t("home.terms")}</Link>
      </div>
    </div>
  );
}
