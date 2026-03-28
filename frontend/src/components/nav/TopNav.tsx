"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { useFriendsStore } from "@/store/friends";
import { useRouter } from "next/navigation";
import UserSearch from "@/components/UserSearch";

export default function TopNav() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const pendingCount = useFriendsStore((s) => s.pendingReceived.length);
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <Link href="/" className="font-bold text-xl text-gray-900">
        Vox Populi
      </Link>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <UserSearch />
            <Link href={`/profile/${user?.username}`} className="text-sm text-gray-600 hover:text-blue-600">
              {user?.username}
            </Link>
            <span className="text-xs text-gray-500">
              BP {user?.bp ?? 0} · KP {user?.kp ?? 0} · TP {user?.tp ?? 0}
            </span>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              Dashboard
            </Link>
            <Link href="/markets" className="text-sm text-blue-600 hover:underline">
              Markets
            </Link>
            <Link href="/friends" className="relative text-sm text-blue-600 hover:underline">
              Friends
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-4 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
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
