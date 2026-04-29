"use client";

import Link from "next/link";
import Image from "next/image";
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
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
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
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <>
      {/* Mobile-only top bar — always visible, contains logo and hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[99] flex items-center justify-between px-4 h-12 bg-white dark:bg-[oklch(14%_0.015_250)] border-b border-gray-200 dark:border-[oklch(22%_0.015_250)]">
        <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Vox Populi</span>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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

      {/* Backdrop — closes sidebar on outside click (mobile only) */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[98] bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`fixed top-0 left-0 w-[220px] h-screen flex flex-col z-[100] bg-white dark:bg-[oklch(14%_0.015_250)] border-r border-gray-200 dark:border-[oklch(22%_0.015_250)] transition-colors duration-200 transition-transform ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>

        {/* 1. Logo */}
        <Link href="/markets" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5 px-4 pt-4 pb-3 shrink-0">
          <Image src="/voxpopuli-logo.png" width={28} height={28} alt="Vox Populi" className="h-7 w-7 rounded-lg shrink-0" />
          <span className="font-bold text-[15px] tracking-tight text-gray-900 dark:text-gray-100">
            Vox Populi
          </span>
        </Link>

        {/* 2. Spacer */}
        <div className="h-2 shrink-0" />

        {/* 3. Username row — clickable, links to profile */}
        <div className="px-4 pb-1 shrink-0">
          <Link
            href={profileHref}
            onClick={() => setMobileOpen(false)}
            className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 truncate hover:text-[var(--accent)] transition-colors"
          >
            @{user?.username}
          </Link>
        </div>

        {/* 4. Point balances row */}
        <div className="px-3 pb-2 flex items-center gap-1 shrink-0">
          {/* LP — light pink */}
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 whitespace-nowrap">
            ❤️ {Math.round(user?.lp ?? 0)}
          </span>
          <span className="text-gray-400 dark:text-gray-600 text-[11px]">♦</span>
          {/* BP — light green */}
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            {(user?.bp ?? 0).toFixed(1)} BP
          </span>
          <span className="text-gray-400 dark:text-gray-600 text-[11px]">♦</span>
          {/* TP — light blue */}
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:sky-400 whitespace-nowrap">
            {(user?.tp ?? 0).toFixed(1)} TP
          </span>
        </div>

        {/* 5. Profile link */}
        <div className="px-2 pb-1 shrink-0">
          <Link
            href={profileHref}
            onClick={() => setMobileOpen(false)}
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

        {/* 6. Search Users */}
        <div className="px-3 pb-2 shrink-0">
          <UserSearch />
        </div>

        {/* 7. Spacer */}
        <div className="h-2 shrink-0" />

        {/* 8. Controls row: language left | theme center | bell right */}
        <div className="px-3 pb-2 flex items-center gap-1 shrink-0">
          <select
            value={mounted ? locale : "en"}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-12 text-[12px] rounded-md border border-gray-200 dark:border-[oklch(26%_0.015_250)] bg-transparent text-gray-500 dark:text-gray-400 px-1 py-1.5 focus:outline-none cursor-pointer"
            aria-label={t("nav.language")}
            suppressHydrationWarning
          >
            <option value="en">EN</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
          </select>
          <div className="flex-1 flex justify-center">
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors shrink-0"
              title={isDark ? t("nav.theme_light") : t("nav.theme_dark")}
              suppressHydrationWarning
            >
              {isDark ? <IconSun /> : <IconMoon />}
            </button>
          </div>
          <div className="ml-auto shrink-0">
            <NotificationBell dropdownAlign="left" />
          </div>
        </div>

        {/* 9. Spacer (Create Market available on /markets page) */}
        <div className="h-3 shrink-0" />

        {/* Divider */}
        <div className="mx-3 border-t border-gray-100 dark:border-[oklch(22%_0.015_250)] mb-1 shrink-0" />

        {/* 10. Nav links: Markets, Friends, Chat, Hall of Fame */}
        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5" aria-label="Main navigation">
          {navLinks.map((n) => {
            const active = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setMobileOpen(false)}
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

        {/* 10.5. Empty row + Logout link after Hall of Fame */}
        <div className="h-2 shrink-0" />
        <div className="px-2 pb-2 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-lg text-[14px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-150"
          >
            <IconLogout />
            <span>{t("nav.logout")}</span>
          </button>
        </div>

        {/* 11. Footer: Privacy Policy left, Terms of Service right */}
        <div className="border-t border-gray-100 dark:border-[oklch(22%_0.015_250)] px-3 py-2 shrink-0 flex items-center justify-between">
          <Link href="/privacy" onClick={() => setMobileOpen(false)} className="text-[10px] text-gray-400 dark:text-gray-500 hover:underline">{t("footer.privacy")}</Link>
          <Link href="/terms" onClick={() => setMobileOpen(false)} className="text-[10px] text-gray-400 dark:text-gray-500 hover:underline">{t("footer.terms")}</Link>
        </div>
      </aside>
    </>
  );
}
