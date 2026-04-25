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
  setSort: (sort: SortOption) => void;
  setFilter: (filter: FilterOption) => void;
  setSearch: (q: string) => void;
  setIncludeDesc: (v: boolean) => void;
  reset: () => void;
}

export const useMarketStore = create<MarketState>()((set, get) => ({
  sort: "deadline",
  sortDir: "asc",
  filter: "all",
  search: "",
  includeDesc: false,
  setSort: (sort) => {
    const { sort: cur, sortDir } = get();
    if (sort === cur) {
      set({ sortDir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      set({ sort, sortDir: DEFAULT_DIRS[sort] });
    }
  },
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  setIncludeDesc: (includeDesc) => set({ includeDesc }),
  reset: () =>
    set({ sort: "deadline", sortDir: "asc", filter: "all", search: "", includeDesc: false }),
}));
