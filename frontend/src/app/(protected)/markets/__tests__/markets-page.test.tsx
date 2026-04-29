import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
const marketStore = {
  sort: "deadline",
  sortDir: "asc",
  filter: "all",
  search: "",
  includeDesc: false,
  setSort: jest.fn(),
  setFilter: jest.fn(),
  setSearch: jest.fn((value: string) => { marketStore.search = value; }),
  setIncludeDesc: jest.fn((value: boolean) => { marketStore.includeDesc = value; }),
};
jest.mock("@/store/market", () => ({ useMarketStore: () => marketStore }));
const socket = { on: jest.fn(), off: jest.fn() };
jest.mock("@/store/socket", () => ({
  useSocketStore: (selector: (state: { socket: typeof socket }) => unknown) => selector({ socket }),
}));
const bootstrap = jest.fn();
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: { user: { id: string }; bootstrap: typeof bootstrap }) => unknown) =>
    selector({ user: { id: "current-user" }, bootstrap }),
}));

import { api } from "@/lib/api";
import MarketsPage from "../page";

const get = api.get as jest.Mock;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MarketsPage /></QueryClientProvider>);
}

const market = {
  id: "market-1",
  title: "Will coverage pass?",
  description: "desc",
  resolution_criteria: "criteria",
  deadline: new Date(Date.now() + 86400000).toISOString(),
  created_at: new Date(Date.now() - 86400000).toISOString(),
  status: "open",
  market_type: "binary",
  yes_pct: 60,
  no_pct: 40,
  yes_count: 3,
  no_count: 2,
  position_count: 5,
  comment_count: 2,
  choice_counts: {},
  upvote_count: 7,
  user_has_liked: false,
  proposer_id: "owner",
  proposer_username: "owner_user",
  proposer_mission: "Make tests useful",
  proposer_created_at: "2026-01-01T00:00:00Z",
  choices: null,
  numeric_min: null,
  numeric_max: null,
};

describe("MarketsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    marketStore.sort = "deadline";
    marketStore.sortDir = "asc";
    marketStore.filter = "all";
    marketStore.search = "";
    marketStore.includeDesc = false;
    global.IntersectionObserver = jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as any;
  });

  it("renders loading, market rows, socket invalidation hooks, and navigation", async () => {
    get.mockResolvedValueOnce({ data: { items: [market], page: 1, pages: 1, total: 1 } });
    renderPage();

    expect(screen.getByText("markets.loading")).toBeInTheDocument();
    expect(await screen.findByText("Will coverage pass?")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getByText("2 markets.comments")).toBeInTheDocument();
    expect(socket.on).toHaveBeenCalledWith("bet:status_changed", expect.any(Function));

    await userEvent.click(screen.getByText("Will coverage pass?"));
    expect(push).toHaveBeenCalledWith("/markets/will-coverage-pass-market-1");
  });

  it("renders empty and error states and updates filters", async () => {
    get.mockResolvedValueOnce({ data: { items: [], page: 1, pages: 1, total: 0 } });
    renderPage();
    expect(await screen.findByText("markets.no_match")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("markets.search_placeholder"), "rain");
    expect(marketStore.setSearch).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("markets.include_desc_search"));
    expect(marketStore.setIncludeDesc).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByText("markets.sort_hot"));
    expect(marketStore.setSort).toHaveBeenCalledWith("active");
    await userEvent.click(screen.getByText("markets.filter_liked"));
    expect(marketStore.setFilter).toHaveBeenCalledWith("liked");
  });

  it("renders load errors", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    await waitFor(() => expect(screen.getByText("markets.load_error")).toBeInTheDocument());
  });
});
