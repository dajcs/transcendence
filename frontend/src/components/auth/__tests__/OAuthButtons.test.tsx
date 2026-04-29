import { render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));

import OAuthButtons from "../OAuthButtons";
import { api } from "@/lib/api";

const get = api.get as jest.Mock;

describe("OAuthButtons", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders configured provider links and skips unknown providers", async () => {
    get.mockResolvedValueOnce({ data: { providers: ["google", "github", "42", "unknown"] } });
    render(<OAuthButtons />);

    expect(await screen.findByRole("link", { name: /auth.continue_google/ })).toHaveAttribute(
      "href",
      "http://localhost/api/auth/oauth/google",
    );
    expect(screen.getByRole("link", { name: /auth.continue_github/ })).toHaveAttribute(
      "href",
      "http://localhost/api/auth/oauth/github",
    );
    expect(screen.getByRole("link", { name: /auth.continue_42/ })).toHaveAttribute(
      "href",
      "http://localhost/api/auth/oauth/42",
    );
    expect(screen.queryByText("unknown")).not.toBeInTheDocument();
  });

  it("renders nothing when providers cannot be fetched", async () => {
    get.mockRejectedValueOnce(new Error("offline"));
    const { container } = render(<OAuthButtons />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/api/auth/oauth/providers"));
    expect(container).toBeEmptyDOMElement();
  });
});
