import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "@/components/NotificationBell";

let socketHandlers: Record<string, (data: unknown) => void> = {};
const mockSocket = {
  on: jest.fn((event: string, handler: (data: unknown) => void) => {
    socketHandlers[event] = handler;
  }),
  off: jest.fn((event: string) => {
    delete socketHandlers[event];
  }),
  emit: jest.fn(),
  connected: true,
};

const notificationStore = {
  notifications: [] as Array<{ id: string; type: string; payload: string | null; is_read: boolean }>,
  unreadCount: 1,
  isOpen: false,
  fetch: jest.fn(),
  fetchUnreadCount: jest.fn(),
  markAsRead: jest.fn().mockResolvedValue(undefined),
  markAllAsRead: jest.fn(),
  toggle: jest.fn(() => {
    notificationStore.isOpen = !notificationStore.isOpen;
  }),
  close: jest.fn(),
};

jest.mock("@/store/socket", () => ({
  useSocketStore: (sel: (s: { socket: typeof mockSocket }) => unknown) =>
    sel({ socket: mockSocket }),
}));

jest.mock("@/store/notifications", () => {
  const useNotificationStore = () => notificationStore;
  useNotificationStore.getState = () => notificationStore;
  return { useNotificationStore };
});

jest.mock("@/i18n", () => ({
  useT: () => (key: string, vars?: Record<string, string>) => {
    if (key === "notif.resolve_market") return `Resolve: ${vars?.title ?? ""}`;
    if (key === "notif.resolution_required") return "Resolution required";
    if (key === "notif.enable_browser_prompt") return "Enable browser notifications";
    if (key === "notif.enable_browser_btn") return "Enable";
    return key;
  },
}));

let locationHref = "http://localhost/";
let mockNotificationFactory: jest.Mock;
let mockRequestPermission: jest.Mock;
let lastNotificationInstance: { onclick: null | (() => void | Promise<void>); close: jest.Mock } | null = null;

function setupNotificationMock(
  permission: NotificationPermission,
  requestedPermission: NotificationPermission = permission,
) {
  mockNotificationFactory = jest.fn(() => {
    lastNotificationInstance = { onclick: null, close: jest.fn() };
    return lastNotificationInstance;
  });
  mockRequestPermission = jest.fn().mockResolvedValue(requestedPermission);

  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: Object.assign(mockNotificationFactory, {
      permission,
      requestPermission: mockRequestPermission,
    }),
  });

  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      get href() {
        return locationHref;
      },
      set href(value: string) {
        locationHref = value;
      },
    },
  });

  window.focus = jest.fn();
}

beforeEach(() => {
  socketHandlers = {};
  jest.clearAllMocks();
  notificationStore.notifications = [];
  notificationStore.unreadCount = 1;
  notificationStore.isOpen = false;
  locationHref = "http://localhost/";
});

describe("NotificationBell", () => {
  it("shows the browser permission prompt only after opening the bell and requests permission on click", async () => {
    setupNotificationMock("default");
    const view = render(<NotificationBell />);

    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(notificationStore.fetchUnreadCount).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    view.rerender(<NotificationBell />);

    expect(await screen.findByText("Enable browser notifications")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledTimes(1));
  });

  it("fires a browser notification for resolution_due and routes to the market on click", async () => {
    setupNotificationMock("granted");
    render(<NotificationBell />);

    act(() => {
      socketHandlers["notification:resolution_due"]?.({
          payload: JSON.stringify({ market_title: "Will it rain?" }),
      });
    });

    expect(mockNotificationFactory).toHaveBeenCalledWith(
      "Vox Populi",
      expect.objectContaining({ body: "Resolve: Will it rain?" }),
    );
    expect(notificationStore.fetchUnreadCount).toHaveBeenCalledTimes(2);

    await act(async () => {
      await lastNotificationInstance?.onclick?.();
    });

    expect(notificationStore.markAsRead).not.toHaveBeenCalled();
    expect(locationHref).toBe("/markets");
  });

  it("marks stored unread resolution notifications as read after enabling browser permission", async () => {
    setupNotificationMock("default", "granted");
    notificationStore.notifications = [
      {
        id: "notif-1",
        type: "resolution_due",
        payload: JSON.stringify({
          market_id: "market-42",
          message: "Please resolve this market",
        }),
        is_read: false,
      },
    ];

    const view = render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    view.rerender(<NotificationBell />);

    await userEvent.click(await screen.findByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(mockNotificationFactory).toHaveBeenCalledWith(
        "Vox Populi",
        expect.objectContaining({ body: "Please resolve this market" }),
      );
    });

    await act(async () => {
      await lastNotificationInstance?.onclick?.();
    });

    expect(notificationStore.markAsRead).toHaveBeenCalledWith(["notif-1"]);
    expect(locationHref).toBe("/markets/market-42");
  });

  it("registers and cleans up notification socket listeners", () => {
    setupNotificationMock("granted");
    const { unmount } = render(<NotificationBell />);

    expect(mockSocket.on).toHaveBeenCalledWith("notification:resolution_due", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("notification:bet_payout", expect.any(Function));

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith("notification:resolution_due", expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith("notification:bet_payout", expect.any(Function));
  });
});
