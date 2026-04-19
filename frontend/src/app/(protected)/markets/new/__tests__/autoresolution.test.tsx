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

// Fills all required fields for a binary market so onSubmit fires.
// Order of textboxes in the binary form (no weather section):
//   [0] title input, [1] description textarea, [2] criteria textarea
async function fillBinaryRequiredFields(container: HTMLElement) {
  const textboxes = screen.getAllByRole("textbox");
  await userEvent.type(textboxes[0], "Test market title");
  await userEvent.type(textboxes[1], "Test description text");
  await userEvent.type(textboxes[2], "Test resolution criteria");
  fireEvent.change(container.querySelector('input[type="date"]')!, {
    target: { value: "2026-12-01" },
  });
}

describe("Auto-resolution payload contract", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: "test-id" } });
  });

  it("resolution_source uses 'location' key (not 'city') and 'open-meteo' provider (hyphen)", async () => {
    const { container } = render(<NewMarketPage />);

    // Select weather market type
    await userEvent.click(screen.getByText("create.weather"));

    // Typing city triggers useEffect → auto-fills title/description/criteria
    await userEvent.type(screen.getByPlaceholderText("Paris"), "London");

    // Set deadline date so the form field is non-empty (satisfies required)
    fireEvent.change(container.querySelector('input[type="date"]')!, {
      target: { value: "2026-12-01" },
    });

    await userEvent.click(screen.getByText("create.submit"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
      const payload = mockPost.mock.calls[0][1];
      // CRITICAL: key must be "location", NOT "city"
      expect(payload.resolution_source).toHaveProperty("location", "London");
      expect(payload.resolution_source).not.toHaveProperty("city");
      // CRITICAL: provider must be "open-meteo" (hyphen), NOT "open_meteo"
      expect(payload.resolution_source.provider).toBe("open-meteo");
    });
  });

  it("resolution_source is absent when market type is binary", async () => {
    const { container } = render(<NewMarketPage />);

    // Default is binary — fill required fields and submit
    await fillBinaryRequiredFields(container);
    await userEvent.click(screen.getByText("create.submit"));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalled();
      const payload = mockPost.mock.calls[0][1];
      expect(payload).not.toHaveProperty("resolution_source");
    });
  });

  it("weather city input is hidden when market type is not weather", () => {
    render(<NewMarketPage />);
    // Default is binary — no city input visible
    expect(screen.queryByPlaceholderText("Paris")).toBeNull();
  });

  it("weather city input appears when weather market type is selected", async () => {
    render(<NewMarketPage />);
    await userEvent.click(screen.getByText("create.weather"));
    expect(screen.getByPlaceholderText("Paris")).toBeTruthy();
  });
});
