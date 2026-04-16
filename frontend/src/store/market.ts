"use client";

import { create } from "zustand";

type SortOption = "deadline" | "active" | "newest";
type SortDir = "asc" | "desc";
type FilterOption = "all" | "my_bets" | "open" | "disputed" | "resolved";

const DEFAULT_DIRS: Record<SortOption, SortDir> = {
  deadline: "asc",
  active: "desc",
  newest: "desc",
};

interface MarketState {
  sort: SortOption;
  sortDir: SortDir;
  filter: FilterOption;
  search: string;
  includeDesc: boolean;
  page: number;
  setSort: (sort: SortOption) => void;
  setFilter: (filter: FilterOption) => void;
  setSearch: (q: string) => void;
  setIncludeDesc: (v: boolean) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketState>()((set, get) => ({
  sort: "deadline",
  sortDir: "asc",
  filter: "all",
  search: "",
  includeDesc: false,
  page: 1,
  setSort: (sort) => {
    const { sort: cur, sortDir } = get();
    if (sort === cur) {
      set({ sortDir: sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      set({ sort, sortDir: DEFAULT_DIRS[sort], page: 1 });
    }
  },
  setFilter: (filter) => set({ filter, page: 1 }),
  setSearch: (search) => set({ search, page: 1 }),
  setIncludeDesc: (includeDesc) => set({ includeDesc, page: 1 }),
  setPage: (page) => set({ page }),
  reset: () =>
    set({ sort: "deadline", sortDir: "asc", filter: "all", search: "", includeDesc: false, page: 1 }),
}));
