jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
const disconnect = jest.fn();
jest.mock("@/store/socket", () => ({
  useSocketStore: { getState: () => ({ disconnect }) },
}));

import { api } from "@/lib/api";
import { useAuthStore } from "../auth";

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;

describe("auth store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("bootstraps authenticated user and applies matching balance updates", async () => {
    get.mockResolvedValueOnce({ data: { id: "u1", email: "a@test.com", username: "alice", avatar_url: null, bp: 1, lp: 2, tp: 3 } });

    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    useAuthStore.getState().applyBalanceUpdate({ user_id: "u1", bp: 4, lp: 5, tp: 6 });
    expect(useAuthStore.getState().user).toMatchObject({ bp: 4, lp: 5, tp: 6 });

    useAuthStore.getState().applyBalanceUpdate({ user_id: "other", bp: 0, lp: 0, tp: 0 });
    expect(useAuthStore.getState().user).toMatchObject({ bp: 4, lp: 5, tp: 6 });
  });

  it("clears auth state on bootstrap failure and logout", async () => {
    get.mockRejectedValueOnce(new Error("401"));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    useAuthStore.setState({ user: { id: "u1", email: "a", username: "a", avatar_url: null, bp: 1, lp: 1, tp: 1 }, isAuthenticated: true });
    post.mockRejectedValueOnce(new Error("ignored"));
    await useAuthStore.getState().logout();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ user: null, isAuthenticated: false });
  });
});
