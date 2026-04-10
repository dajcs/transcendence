"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { useAuthStore } from "@/store/auth";

export default function PrivacyPage() {
  const t = useT();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const homeHref = isAuthenticated ? "/dashboard" : "/";

  return (
    <article className="prose prose-sm max-w-3xl mx-auto dark:prose-invert">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t("privacy.title")}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t("privacy.updated")}</p>

      <section className="mt-8 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s1.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("privacy.s1.intro")}</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("privacy.s1.account")}</li>
            <li>{t("privacy.s1.oauth")}</li>
            <li>{t("privacy.s1.activity")}</li>
            <li>{t("privacy.s1.ledger")}</li>
            <li>{t("privacy.s1.session")}</li>
            <li>{t("privacy.s1.logs")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s2.title")}</h2>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("privacy.s2.use1")}</li>
            <li>{t("privacy.s2.use2")}</li>
            <li>{t("privacy.s2.use3")}</li>
            <li>{t("privacy.s2.use4")}</li>
            <li>{t("privacy.s2.use5")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s3.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("privacy.s3.intro")}</p>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 dark:border-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">{t("privacy.s3.table.service")}</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">{t("privacy.s3.table.data")}</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">{t("privacy.s3.table.purpose")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700 text-gray-700 dark:text-gray-300">
                <tr><td className="px-4 py-2">Google OAuth</td><td className="px-4 py-2">Email, name</td><td className="px-4 py-2">{t("privacy.s3.table.auth")}</td></tr>
                <tr><td className="px-4 py-2">GitHub OAuth</td><td className="px-4 py-2">Email, username</td><td className="px-4 py-2">{t("privacy.s3.table.auth")}</td></tr>
                <tr><td className="px-4 py-2">42 School OAuth</td><td className="px-4 py-2">Email, login</td><td className="px-4 py-2">{t("privacy.s3.table.auth")}</td></tr>
                <tr><td className="px-4 py-2">OpenRouter (LLM)</td><td className="px-4 py-2">{t("privacy.s3.table.llm_data")}</td><td className="px-4 py-2">{t("privacy.s3.table.llm_purpose")}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("privacy.s3.disclaimer")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s4.title")}</h2>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("privacy.s4.account")}</li>
            <li>{t("privacy.s4.activity")}</li>
            <li>{t("privacy.s4.ledger")}</li>
            <li>{t("privacy.s4.session")}</li>
            <li>{t("privacy.s4.logs")}</li>
            <li>{t("privacy.s4.llm")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s5.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("privacy.s5.intro")}</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("privacy.s5.access")}</li>
            <li>{t("privacy.s5.erasure")}</li>
            <li>{t("privacy.s5.rectification")}</li>
            <li>{t("privacy.s5.portability")}</li>
            <li>{t("privacy.s5.object")}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s6.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{t("privacy.s6.intro")}</p>
          <ul className="mt-2 list-disc pl-6 text-gray-700 dark:text-gray-300 space-y-1">
            <li>{t("privacy.s6.refresh")}</li>
            <li>{t("privacy.s6.access_token")}</li>
          </ul>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("privacy.s6.no_tracking")}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("privacy.s7.title")}</h2>
          <p className="mt-2 text-gray-700 dark:text-gray-300">
            {t("privacy.s7.text")}{" "}
            <a href="https://github.com/dajcs/transcendence" className="text-blue-600 hover:underline dark:text-blue-400" target="_blank" rel="noopener noreferrer">
              {t("privacy.s7.link")}
            </a>.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-500 dark:text-gray-400">
        <Link href="/terms" className="text-blue-600 hover:underline dark:text-blue-400">{t("privacy.link_terms")}</Link>
        {" · "}
        <Link href={homeHref} className="text-blue-600 hover:underline dark:text-blue-400">{t("privacy.link_home")}</Link>
      </div>
    </article>
  );
}
