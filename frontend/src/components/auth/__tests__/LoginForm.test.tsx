import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));
const push = jest.fn();
const searchParamsGet = jest.fn((_: string): string | null => null);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
const bootstrap = jest.fn();
jest.mock("@/store/auth", () => ({
  useAuthStore: (selector: (state: { bootstrap: jest.Mock }) => unknown) =>
    selector({ bootstrap }),
}));

import LoginForm from "../LoginForm";
import { api } from "@/lib/api";

const mockPost = api.post as jest.Mock;

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it("shows client-side validation errors without calling the API when fields are empty", async () => {
    render(<LoginForm />);

    await userEvent.click(screen.getByRole("button", { name: "auth.login" }));

    expect(await screen.findByText("auth.validation_email_required")).toBeInTheDocument();
    expect(screen.getByText("auth.validation_password_required")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("shows field validation instead of throwing when password is cleared after a failed login", async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: "Invalid credentials" } },
    });

    render(<LoginForm />);

    const identifierInput = screen.getByPlaceholderText("auth.enter_email_or_username");
    const passwordInput = screen.getByPlaceholderText("auth.password");
    const submitButton = screen.getByRole("button", { name: "auth.login" });

    await userEvent.type(identifierInput, "demo");
    await userEvent.type(passwordInput, "wrong-password");
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    await userEvent.clear(passwordInput);
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(screen.getByText("auth.validation_password_required")).toBeInTheDocument();
    });
  });

  it("shows array-based API validation messages returned by the backend", async () => {
    mockPost.mockRejectedValueOnce({
      response: { data: { detail: [{ msg: "Locked account" }] } },
    });

    render(<LoginForm />);

    await userEvent.type(screen.getByPlaceholderText("auth.enter_email_or_username"), "demo");
    await userEvent.type(screen.getByPlaceholderText("auth.password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "auth.login" }));

    expect(await screen.findByText("Locked account")).toBeInTheDocument();
  });

  it("bootstraps auth state and redirects after a successful login", async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    render(<LoginForm />);

    await userEvent.type(screen.getByPlaceholderText("auth.enter_email_or_username"), "demo");
    await userEvent.type(screen.getByPlaceholderText("auth.password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "auth.login" }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith("/api/auth/login", {
        identifier: "demo",
        password: "secret",
      });
      expect(bootstrap).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/markets");
    });
  });

  it("renders the OAuth error passed through the search params", () => {
    searchParamsGet.mockReturnValue("oauth_failed");

    render(<LoginForm />);

    expect(screen.getByText("oauth_failed")).toBeInTheDocument();
  });
});
