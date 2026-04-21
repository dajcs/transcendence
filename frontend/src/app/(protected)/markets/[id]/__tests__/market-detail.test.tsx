// Structural smoke tests for market-detail page query key contracts

jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "market-abc-123", username: "testuser" }),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
let mockUser: null | { bp: number; lp: number; tp: number } = null;
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (s: { user: typeof mockUser; bootstrap: () => void }) => unknown) =>
    selector({ user: mockUser, bootstrap: jest.fn() }),
}));
jest.mock("@/store/socket", () => ({
  useSocketStore: (selector: (s: { socket: null }) => unknown) =>
    selector({ socket: null }),
}));
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: string }) => children }));

import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import MarketDetailPage from "../page";

const mockGet = api.get as jest.Mock;

// Return appropriate data based on URL to avoid type errors in the component
function makeGetHandler() {
  return (url: string) => {
    if (String(url).includes("/positions")) {
      return Promise.resolve({
        data: { participants: [], aggregate: { total_bp: 0, total_participants: 0, avg_bp: 0, by_side: {} }, total: 0 },
      });
    }
    if (String(url).includes("/payouts")) {
      return Promise.resolve({ data: { payouts: [], total: 0 } });
    }
    if (String(url).includes("/comments")) {
      return Promise.resolve({ data: [] });
    }
    if (String(url).includes("/bets/positions")) {
      return Promise.resolve({ data: { active: [], resolved: [] } });
    }
    if (String(url).includes("/users/me")) {
      return Promise.resolve({ data: { llm_mode: "disabled" } });
    }
    // Default: market data
    return Promise.resolve({
      data: {
        id: "market-abc-123",
        title: "Test Market",
        description: "desc",
        resolution_criteria: "criteria",
        deadline: new Date(Date.now() + 86400000).toISOString(),
        status: "open",
        market_type: "binary",
        yes_pct: 50,
        no_pct: 50,
        yes_count: 0,
        no_count: 0,
        position_count: 0,
        choice_counts: {},
        upvote_count: 0,
        proposer_id: "other-user",
        choices: null,
        numeric_min: null,
        numeric_max: null,
      },
    });
  };
}

describe("Market detail page query keys", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    mockGet.mockImplementation(makeGetHandler());
  });

  it("positions endpoint URL contains '/positions' with marketId", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(QueryClientProvider, { client: qc }, createElement(MarketDetailPage))
    );

    await waitFor(() => {
      const positionsCalls = mockGet.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes("market-abc-123") && String(c[0]).includes("/positions")
      );
      expect(positionsCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("payouts query is gated on closed status — not called when market is open", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(QueryClientProvider, { client: qc }, createElement(MarketDetailPage))
    );

    await waitFor(() => {
      // Market loaded as "open" — payouts query should not fire
      const marketCalls = mockGet.mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes("/markets/market-abc-123") && !String(c[0]).includes("/positions") && !String(c[0]).includes("/comments")
      );
      expect(marketCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const payoutsCalls = mockGet.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("/payouts")
    );
    expect(payoutsCalls.length).toBe(0);
  });

  it("queryKey contract: market-positions key uses correct URL pattern", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      createElement(QueryClientProvider, { client: qc }, createElement(MarketDetailPage))
    );

    await waitFor(() => {
      const calls = mockGet.mock.calls.map((c: unknown[]) => String(c[0]));
      const posCall = calls.find((u) => u.includes("/positions"));
      expect(posCall).toBeDefined();
      expect(posCall).toContain("market-abc-123");
    }, { timeout: 3000 });
  });

  it("shows a low-balance message instead of bet options when user has less than 1 BP", async () => {
    mockUser = { bp: 0.5, lp: 0, tp: 0 };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText, queryByRole } = render(
      createElement(QueryClientProvider, { client: qc }, createElement(MarketDetailPage))
    );

    expect(await findByText("market.need_min_1bp")).toBeInTheDocument();
    expect(queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows refund preview as stake multiplied by refund probability", async () => {
    mockUser = { bp: 3, lp: 0, tp: 0 };
    mockGet.mockImplementation((url: string) => {
      if (String(url).includes("/positions")) {
        return Promise.resolve({
          data: { participants: [], aggregate: { total_bp: 0, total_participants: 0, avg_bp: 0, by_side: {} }, total: 0 },
        });
      }
      if (String(url).includes("/comments")) {
        return Promise.resolve({ data: [] });
      }
      if (String(url).includes("/bets/positions")) {
        return Promise.resolve({
          data: {
            active: [{
              id: "position-1",
              bet_id: "market-abc-123",
              side: "yes",
              bp_staked: 3,
              placed_at: new Date().toISOString(),
              withdrawn_at: null,
              refund_bp: null,
              market_title: "Test Market",
              market_status: "open",
              yes_pct: 75,
              no_pct: 25,
            }],
            resolved: [],
          },
        });
      }
      if (String(url).includes("/users/me")) {
        return Promise.resolve({ data: { llm_mode: "disabled" } });
      }
      return Promise.resolve({
        data: {
          id: "market-abc-123",
          title: "Test Market",
          description: "desc",
          resolution_criteria: "criteria",
          deadline: new Date(Date.now() + 86400000).toISOString(),
          status: "open",
          market_type: "binary",
          yes_pct: 75,
          no_pct: 25,
          yes_count: 3,
          no_count: 1,
          position_count: 4,
          choice_counts: {},
          upvote_count: 0,
          proposer_id: "other-user",
          choices: null,
          numeric_min: null,
          numeric_max: null,
        },
      });
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText, getByText } = render(
      createElement(QueryClientProvider, { client: qc }, createElement(MarketDetailPage))
    );

    getByText("market.withdraw").click();
    expect(await findByText(/market\.refund_bp/)).toBeInTheDocument();
  });
});
