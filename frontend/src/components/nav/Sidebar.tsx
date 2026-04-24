"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { useFriendsStore } from "@/store/friends";
import { useLocaleStore, type Locale } from "@/store/locale";
import NotificationBell from "@/components/NotificationBell";
import UserSearch from "@/components/UserSearch";
import { useT } from "@/i18n";
import { useState, useEffect } from "react";

const IconMarkets = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
  </svg>
);
const IconFriends = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconChat = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconTrophy = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
);
const IconProfile = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconSun = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
);
const IconMoon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function Sidebar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const { toggle, theme } = useThemeStore();
  const pendingCount = useFriendsStore((s) => s.pendingReceived.length);
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!isAuthenticated) return null;

  const profileHref = `/profile/${encodeURIComponent(user?.username ?? "")}`;
  const isDark = mounted && theme === "dark";

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href || pathname.startsWith(href + "/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const navLinks = [
    { href: "/markets", label: t("nav.markets"), icon: <IconMarkets /> },
    { href: "/friends", label: t("nav.friends"), icon: <IconFriends />, badge: pendingCount },
    { href: "/chat", label: t("nav.chat"), icon: <IconChat /> },
    { href: "/hall-of-fame", label: t("nav.hall_of_fame"), icon: <IconTrophy /> },
  ];

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <aside className="fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r border-gray-200 dark:border-[oklch(22%_0.015_250)] transition-colors duration-200">

      {/* 1. Logo */}
      <Link href="/markets" className="flex items-center gap-2.5 px-4 pt-4 pb-3 shrink-0">
        <div className="w-[28px] h-[28px] rounded-lg flex items-center justify-center text-white font-extrabold text-sm shrink-0 bg-[var(--accent)]">
          V
        </div>
        <span className="font-bold text-[15px] tracking-tight text-gray-900 dark:text-gray-100">
          Vox Populi
        </span>
      </Link>

      {/* 2. Points pills */}
      <div className="px-3 pb-2 flex flex-wrap gap-1 shrink-0">
        {/* LP — light pink */}
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 whitespace-nowrap">
          ❤️ {Math.round(user?.lp ?? 0)}
        </span>
        {/* BP — light green */}
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          ♦ {(user?.bp ?? 0).toFixed(1)} BP
        </span>
        {/* TP — light blue */}
        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 whitespace-nowrap">
          ✦ {(user?.tp ?? 0).toFixed(1)} TP
        </span>
      </div>

      {/* 3. Username */}
      <div className="px-4 pb-1 shrink-0 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 truncate">
          @{user?.username}
        </span>
        <button
          onClick={handleLogout}
          className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
          title={t("nav.logout")}
        >
          <IconLogout />
        </button>
      </div>

      {/* 4. Profile link */}
      <div className="px-2 pb-1 shrink-0">
        <Link
          href={profileHref}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
            isActive(profileHref)
              ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 font-normal"
          }`}
        >
          <IconProfile />
          Profile
        </Link>
      </div>

      {/* 5. User search */}
      <div className="px-3 pb-2 shrink-0">
        <UserSearch />
      </div>

      {/* 6. Controls: language + theme + notifications */}
      <div className="px-3 pb-2 flex items-center gap-1 shrink-0">
        <select
          value={mounted ? locale : "en"}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="flex-1 text-[12px] rounded-md border border-gray-200 dark:border-[oklch(26%_0.015_250)] bg-transparent text-gray-500 dark:text-gray-400 px-2 py-1.5 focus:outline-none cursor-pointer"
          aria-label={t("nav.language")}
          suppressHydrationWarning
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
          title={isDark ? t("nav.theme_light") : t("nav.theme_dark")}
          suppressHydrationWarning
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
        <div className="shrink-0">
          <NotificationBell dropdownAlign="left" />
        </div>
      </div>

      {/* 7. Create Market button */}
      <div className="px-3 pb-3 shrink-0">
        <Link
          href="/markets/new"
          className="block w-full text-center text-[13px] font-semibold py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          + {t("markets.create")}
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-gray-100 dark:border-[oklch(22%_0.015_250)] mb-1 shrink-0" />

      {/* 8–11. Nav links */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5" aria-label="Main navigation">
        {navLinks.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-all duration-150 ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 font-normal"
              }`}
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.badge && n.badge > 0 && (
                <span className="ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {n.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: privacy/terms */}
      <div className="border-t border-gray-100 dark:border-[oklch(22%_0.015_250)] px-3 py-2 shrink-0 flex items-center justify-end">
        <div className="flex gap-2 text-[10px] text-gray-400 dark:text-gray-500">
          <Link href="/privacy" className="hover:underline">{t("footer.privacy")}</Link>
          <Link href="/terms" className="hover:underline">{t("footer.terms")}</Link>
        </div>
      </div>
    </aside>
  );
}
