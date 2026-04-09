"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
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
        className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm w-48 focus:border-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
                {user.username[0].toUpperCase()}
              </div>
              <span>{user.username}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
