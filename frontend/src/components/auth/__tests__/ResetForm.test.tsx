import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("@/lib/api", () => ({ api: { post: jest.fn() } }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));

import ResetForm from "../ResetForm";
import { api } from "@/lib/api";

const post = api.post as jest.Mock;

describe("ResetForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("validates email before submitting", async () => {
    render(<ResetForm />);
    const email = screen.getByLabelText("auth.email");

    await userEvent.type(email, "bad");
    await userEvent.click(screen.getByRole("button", { name: "auth.send_reset" }));

    expect(await screen.findByText("auth.validation_invalid_email")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("shows sent state even when the reset request is swallowed", async () => {
    post.mockRejectedValueOnce(new Error("hidden"));
    render(<ResetForm />);
    const email = screen.getByLabelText("auth.email");

    await userEvent.type(email, "user@example.com");
    await userEvent.click(screen.getByRole("button", { name: "auth.send_reset" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/auth/reset-request", { email: "user@example.com" }));
    expect(screen.getByText("auth.reset_sent")).toBeInTheDocument();
  });
});
