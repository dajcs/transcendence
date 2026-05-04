"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Avatar from "@/components/Avatar";
import { useT } from "@/i18n";

interface UserResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function UserSearch() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<UserResult[]>(
          `/api/users/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        setResults(data);
        setIsOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setIsOpen(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        placeholder={t("nav.search_users")}
        className="rounded-lg border border-gray-200 dark:border-[oklch(26%_0.015_250)] px-3 py-1.5 text-[13px] w-full focus:border-[var(--accent)] focus:outline-none bg-gray-50 dark:bg-[oklch(18%_0.015_250)] text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
      />
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {results.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${encodeURIComponent(user.username)}`}
              onClick={() => {
                setIsOpen(false);
                setQuery("");
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-100"
            >
              <Avatar username={user.username} avatarUrl={user.avatar_url} className="h-6 w-6" textClassName="text-xs" />
              <span>{user.username}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
