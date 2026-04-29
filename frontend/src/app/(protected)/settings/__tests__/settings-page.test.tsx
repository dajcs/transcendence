import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
const setLocale = jest.fn();
jest.mock("@/store/locale", () => ({
  useLocaleStore: (selector: (state: { locale: string; setLocale: typeof setLocale }) => unknown) =>
    selector({ locale: "en", setLocale }),
}));

import { api } from "@/lib/api";
import SettingsPage from "../page";

const get = api.get as jest.Mock;
const patch = api.patch as jest.Mock;
const del = api.delete as jest.Mock;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>);
}

function mockSettings({ available = true, mode = "custom" } = {}) {
  get.mockImplementation((url: string) => {
    if (url === "/api/config/llm-available") return Promise.resolve({ data: { available } });
    if (url === "/api/users/me") return Promise.resolve({
      data: { llm_mode: mode, llm_provider: "openai", llm_model: "gpt-test", llm_api_key_set: true },
    });
    if (url === "/api/users/data-export") return Promise.resolve({ data: { account: { username: "alice" } } });
    return Promise.reject(new Error("unexpected"));
  });
}

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettings();
    patch.mockResolvedValue({ data: {} });
    del.mockResolvedValue({ data: {} });
    URL.createObjectURL = jest.fn(() => "blob:url");
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(window, "location", { configurable: true, value: { assign: jest.fn() } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads settings, updates language and saves custom LLM settings", async () => {
    renderPage();

    expect(await screen.findByText("settings.title")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByDisplayValue("English"), "fr");
    expect(setLocale).toHaveBeenCalledWith("fr");

    await userEvent.type(screen.getByPlaceholderText("settings.api_key_saved"), "secret");
    await userEvent.clear(screen.getByDisplayValue("gpt-test"));
    await userEvent.type(screen.getByPlaceholderText("settings.model_placeholder"), "gpt-4o-mini");
    await userEvent.click(screen.getByRole("button", { name: "settings.save" }));

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith("/api/users/me", {
        llm_mode: "custom",
        llm_provider: "openai",
        llm_api_key: "secret",
        llm_model: "gpt-4o-mini",
      });
      expect(screen.getByText("settings.save_success")).toBeInTheDocument();
    });
  });

  it("disables platform default when platform key is unavailable", async () => {
    mockSettings({ available: false, mode: "default" });
    renderPage();

    await screen.findByText("settings.title");
    expect(screen.queryByText("settings.platform_default")).not.toBeInTheDocument();
    await waitFor(() => {
      const disabledLabel = screen.getByText("settings.disabled").closest("label");
      expect(disabledLabel?.querySelector('input[type="radio"]')).toBeChecked();
    });
  });

  it("exports data and shows export errors", async () => {
    const first = renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "settings.export_data" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/api/users/data-export"));
    first.unmount();

    get.mockImplementation((url: string) => {
      if (url === "/api/config/llm-available") return Promise.resolve({ data: { available: true } });
      if (url === "/api/users/me") return Promise.resolve({ data: { llm_mode: "disabled", llm_provider: null, llm_model: null, llm_api_key_set: false } });
      if (url === "/api/users/data-export") return Promise.reject(new Error("export failed"));
      return Promise.reject(new Error("unexpected"));
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "settings.export_data" }));
    expect(await screen.findByText("settings.export_error")).toBeInTheDocument();
  });

  it("requires delete confirmation and routes home after deletion", async () => {
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "settings.delete_account" }));
    const deleteButtons = screen.getAllByRole("button", { name: "settings.delete_account" });
    expect(deleteButtons[1]).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("settings.delete_confirm"), "DELETE");
    await userEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(del).toHaveBeenCalledWith("/api/users/account");
      expect(window.location.assign).toHaveBeenCalledWith("/");
    });
  });
});
