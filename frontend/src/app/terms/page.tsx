"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export default function TermsPage() {
  const t = useT();

  return (
    <article className="prose prose-sm max-w-3xl mx-auto dark:prose-invert">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t("terms.title")}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("terms.updated")}</p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s1.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s1.intro")}</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("terms.s1.use1")}</li>
            <li>{t("terms.s1.use2")}</li>
            <li>{t("terms.s1.use3")}</li>
            <li>{t("terms.s1.use4")}</li>
            <li>{t("terms.s1.use5")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s2.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s2.text")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s3.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s3.intro")}</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("terms.s3.rule1")}</li>
            <li>{t("terms.s3.rule2")}</li>
            <li>{t("terms.s3.rule3")}</li>
            <li>{t("terms.s3.rule4")}</li>
          </ul>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("terms.s3.disclaimer")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s4.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            {t("terms.s4.text")}{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">{t("terms.s4.privacy_link")}</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s5.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s5.text")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s6.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s6.text")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s7.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s7.text")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s8.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s8.text")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("terms.s9.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("terms.s9.text")}</p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">{t("terms.link_privacy")}</Link>
        {" · "}
        <Link href="/" className="text-blue-600 hover:underline dark:text-blue-400">{t("terms.link_home")}</Link>
      </div>
    </article>
  );
}
