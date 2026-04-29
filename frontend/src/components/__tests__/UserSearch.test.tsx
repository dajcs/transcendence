import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, onClick, children, ...props }: any) => (
    <a
      href={href}
      onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

import UserSearch from "../UserSearch";
import { api } from "@/lib/api";

const get = api.get as jest.Mock;

describe("UserSearch", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it("debounces user search and links to selected profiles", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    get.mockResolvedValueOnce({ data: [{ id: "u1", username: "alice", avatar_url: null }] });
    render(<UserSearch />);

    await user.type(screen.getByPlaceholderText("nav.search_users"), "al");
    await act(async () => { jest.advanceTimersByTime(300); });

    expect(await screen.findByRole("link", { name: /alice/i })).toHaveAttribute("href", "/profile/alice");
    expect(get).toHaveBeenCalledWith("/api/users/search?q=al", expect.objectContaining({ signal: expect.any(AbortSignal) }));

    await user.click(screen.getByRole("link", { name: /alice/i }));
    await waitFor(() => expect(screen.queryByRole("link", { name: /alice/i })).not.toBeInTheDocument());
    expect(screen.getByPlaceholderText("nav.search_users")).toHaveValue("");
  });

  it("hides results for short queries and failed searches", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    get.mockRejectedValueOnce(new Error("network"));
    render(<UserSearch />);

    await user.type(screen.getByPlaceholderText("nav.search_users"), "a");
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(get).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText("nav.search_users"), "b");
    await act(async () => { jest.advanceTimersByTime(300); });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
