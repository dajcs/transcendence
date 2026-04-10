"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";
import { useRouter } from "next/navigation";
import { useThemeStore } from "@/store/theme";
import { useState, useEffect } from "react";
import NotificationBell from "@/components/NotificationBell";
import UserSearch from "@/components/UserSearch";
import { useT } from "@/i18n";
import { useLocaleStore, type Locale } from "@/store/locale";

function ThemeToggle() {
  const { toggle, theme } = useThemeStore();
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";
  return (
    <button
      onClick={toggle}
      className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      aria-label="Toggle dark mode"
      title={mounted ? (isDark ? t("nav.theme_light") : t("nav.theme_dark")) : ""}
      suppressHydrationWarning
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

function LanguageSelector() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-1.5 py-1 focus:outline-none"
      aria-label="Language"
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
      <option value="de">DE</option>
    </select>
  );
}

export default function TopNav() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const pendingCount = useFriendsStore((s) => s.pendingReceived.length);
  const router = useRouter();
  const t = useT();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <Link href="/" className="font-bold text-xl text-gray-900 dark:text-gray-100">
        {t("app.name")}
      </Link>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <UserSearch />
            <Link href={`/profile/${encodeURIComponent(user?.username ?? "")}`} className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:underline">
              {user?.username}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              BP {user?.bp ?? 0} · KP {user?.kp ?? 0} · TP {user?.tp ?? 0}
            </span>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              {t("nav.dashboard")}
            </Link>
            <Link href="/markets" className="text-sm text-blue-600 hover:underline">
              {t("nav.markets")}
            </Link>
            <Link href="/friends" className="relative text-sm text-blue-600 hover:underline">
              {t("nav.friends")}
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
            <Link href="/chat" className="text-sm text-blue-600 hover:underline">
              {t("nav.chat")}
            </Link>
            <Link href="/settings" className="text-sm text-blue-600 hover:underline">
              {t("nav.settings")}
            </Link>
            <NotificationBell />
            <ThemeToggle />
            <LanguageSelector />
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
              {t("nav.login")}
            </Link>
            <ThemeToggle />
            <LanguageSelector />
            <Link
              href="/register"
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t("nav.signup")}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
