"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import UserSearch from "@/components/UserSearch";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-700 dark:hover:text-gray-100 transition-colors"
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

export default function TopNav() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const pendingCount = useFriendsStore((s) => s.pendingReceived.length);
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 dark:bg-slate-800">
      <Link href="/" className="font-bold text-xl text-gray-900 dark:text-gray-100">
        Vox Populi
      </Link>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <UserSearch />
            <Link href={`/profile/${encodeURIComponent(user?.username ?? "")}`} className="text-sm text-gray-600 hover:text-blue-600 hover:underline dark:text-gray-300 dark:hover:text-blue-400">
              {user?.username}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              BP {user?.bp ?? 0} · KP {user?.kp ?? 0} · TP {user?.tp ?? 0}
            </span>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Dashboard
            </Link>
            <Link href="/markets" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Markets
            </Link>
            <Link href="/friends" className="relative text-sm text-blue-600 hover:underline dark:text-blue-400">
              Friends
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
            <Link href="/chat" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Chat
            </Link>
            <Link href="/settings" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Settings
            </Link>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link href="/login" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
