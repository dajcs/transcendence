"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export default function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 mt-8 py-4">
      <div className="max-w-4xl mx-auto px-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/privacy" className="hover:underline">{t("footer.privacy")}</Link>
        <Link href="/terms" className="hover:underline">{t("footer.terms")}</Link>
      </div>
    </footer>
  );
}
