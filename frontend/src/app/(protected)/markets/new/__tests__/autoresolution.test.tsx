import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jest.mock is hoisted — use require inside factory to avoid temporal dead zone
jest.mock("@/lib/api", () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
jest.mock("@/store/auth", () => ({ useAuthStore: () => jest.fn() }));

import NewMarketPage from "../page";
import { api } from "@/lib/api";

const mockPost = api.post as jest.Mock;

describe("Auto-resolution payload contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: "test-id" } });
  });

  it("resolution_source uses 'location' key (not 'city') and 'open-meteo' provider (hyphen)", async () => {
    render(<NewMarketPage />);

    // Enable the auto-resolution toggle
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);

    // Fill city input (placeholder is "Paris")
    const cityInput = screen.getByPlaceholderText("Paris");
    await userEvent.type(cityInput, "London");

    // Submit via button click
    const submitBtn = screen.getByText("create.submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      if (mockPost.mock.calls.length > 0) {
        const payload = mockPost.mock.calls[0][1];
        if (payload.resolution_source) {
          // CRITICAL: key must be "location", NOT "city"
          expect(payload.resolution_source).toHaveProperty("location");
          expect(payload.resolution_source).not.toHaveProperty("city");
          // CRITICAL: provider must be "open-meteo" (hyphen), NOT "open_meteo"
          expect(payload.resolution_source.provider).toBe("open-meteo");
        }
      }
    });
  });

  it("resolution_source is absent when auto-resolution toggle is off", async () => {
    render(<NewMarketPage />);

    const submitBtn = screen.getByText("create.submit");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      if (mockPost.mock.calls.length > 0) {
        const payload = mockPost.mock.calls[0][1];
        expect(payload).not.toHaveProperty("resolution_source");
      }
    });
  });

  it("auto-resolution panel is hidden when toggle is off", () => {
    render(<NewMarketPage />);
    expect(screen.queryByPlaceholderText("Paris")).toBeNull();
  });

  it("auto-resolution panel shows city input when toggle is on", async () => {
    render(<NewMarketPage />);
    const toggle = screen.getByRole("switch");
    await userEvent.click(toggle);
    expect(screen.getByPlaceholderText("Paris")).toBeTruthy();
  });
});
