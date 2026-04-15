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
      aria-label={mounted ? (isDark ? t("nav.theme_light") : t("nav.theme_dark")) : t("nav.theme_dark")}
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
  const t = useT();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs px-1.5 py-1 focus:outline-none"
      aria-label={t("nav.language")}
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700">
      {/* Main bar — always visible */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-2">
        <Link href="/" className="font-bold text-xl text-gray-900 dark:text-gray-100 shrink-0">
          {t("app.name")}
        </Link>

        {/* Desktop nav links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-3 flex-wrap justify-end flex-1 min-w-0">
          {isAuthenticated ? (
            <>
              <UserSearch />
              <Link
                href={`/profile/${encodeURIComponent(user?.username ?? "")}`}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:underline shrink-0"
              >
                {user?.username}
              </Link>
              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
                KP&nbsp;{user?.kp ?? 0}{"\u00a0"}BP&nbsp;{user?.bp ?? 0}{"\u00a0"}TP&nbsp;{user?.tp ?? 0}
              </span>
              <Link href="/dashboard" className="text-sm text-blue-600 hover:underline shrink-0">
                {t("nav.dashboard")}
              </Link>
              <Link href="/markets" className="text-sm text-blue-600 hover:underline shrink-0">
                {t("nav.markets")}
              </Link>
              <Link href="/friends" className="relative text-sm text-blue-600 hover:underline shrink-0">
                {t("nav.friends")}
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/chat" className="text-sm text-blue-600 hover:underline shrink-0">
                {t("nav.chat")}
              </Link>
              <Link href="/settings" className="text-sm text-blue-600 hover:underline shrink-0">
                {t("nav.settings")}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 shrink-0"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-blue-600 hover:underline">
                {t("nav.login")}
              </Link>
              <Link href="/register" className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>

        {/* Always-visible controls: bell + theme + language + hamburger */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated && <NotificationBell />}
          <ThemeToggle />
          <LanguageSelector />
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            aria-label="Toggle menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-col gap-3">
          {isAuthenticated ? (
            <>
              <UserSearch />
              <Link
                href={`/profile/${encodeURIComponent(user?.username ?? "")}`}
                onClick={() => setMobileOpen(false)}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600"
              >
                {user?.username}
              </Link>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                KP&nbsp;{user?.kp ?? 0}{"\u00a0"}BP&nbsp;{user?.bp ?? 0}{"\u00a0"}TP&nbsp;{user?.tp ?? 0}
              </span>
              <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="text-sm text-blue-600 hover:underline">
                {t("nav.dashboard")}
              </Link>
              <Link href="/markets" onClick={() => setMobileOpen(false)} className="text-sm text-blue-600 hover:underline">
                {t("nav.markets")}
              </Link>
              <Link href="/friends" onClick={() => setMobileOpen(false)} className="relative text-sm text-blue-600 hover:underline w-fit">
                {t("nav.friends")}
                {pendingCount > 0 && (
                  <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link href="/chat" onClick={() => setMobileOpen(false)} className="text-sm text-blue-600 hover:underline">
                {t("nav.chat")}
              </Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)} className="text-sm text-blue-600 hover:underline">
                {t("nav.settings")}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 w-fit"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm text-blue-600 hover:underline">
                {t("nav.login")}
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)} className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 w-fit">
                {t("nav.signup")}
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
