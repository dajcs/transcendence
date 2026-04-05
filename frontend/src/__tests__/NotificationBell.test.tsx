/**
 * NotificationBell — browser notification tests.
 *
 * Covers:
 *   1. Notification.requestPermission() called on mount
 *   2. new Notification() fired when notification:resolution_due arrives and permission is granted
 *   3. new Notification() NOT fired when permission is denied
 */
import React from "react";
import { render, act } from "@testing-library/react";
import NotificationBell from "@/components/NotificationBell";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Capture socket event handlers so tests can trigger them manually
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

jest.mock("@/store/socket", () => ({
  useSocketStore: (sel: (s: { socket: typeof mockSocket }) => unknown) =>
    sel({ socket: mockSocket }),
}));

jest.mock("@/store/notifications", () => ({
  useNotificationStore: () => ({
    notifications: [],
    unreadCount: 0,
    isOpen: false,
    fetch: jest.fn(),
    fetchUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    toggle: jest.fn(),
    close: jest.fn(),
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Notification API mock helpers
// ---------------------------------------------------------------------------

let mockNotification: jest.Mock;
let mockRequestPermission: jest.Mock;

function setupNotificationMock(permission: NotificationPermission) {
  mockNotification = jest.fn();
  mockRequestPermission = jest.fn().mockResolvedValue(permission);

  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: Object.assign(mockNotification, {
      permission,
      requestPermission: mockRequestPermission,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  socketHandlers = {};
  jest.clearAllMocks();
});

describe("NotificationBell — permission request", () => {
  it("requests Notification permission on mount when status is default", () => {
    setupNotificationMock("default");
    render(<NotificationBell />);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("does not re-request if permission is already granted", () => {
    setupNotificationMock("granted");
    render(<NotificationBell />);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it("does not re-request if permission is denied", () => {
    setupNotificationMock("denied");
    render(<NotificationBell />);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe("NotificationBell — resolution_due browser notification", () => {
  it("fires new Notification() when resolution_due arrives and permission is granted", () => {
    setupNotificationMock("granted");
    render(<NotificationBell />);

    act(() => {
      socketHandlers["notification:resolution_due"]?.({
        payload: JSON.stringify({ market_title: "Will it rain?" }),
      });
    });

    expect(mockNotification).toHaveBeenCalledWith(
      "Vox Populi",
      expect.objectContaining({ body: "Resolve: Will it rain?" }),
    );
  });

  it("shows fallback title when payload has no market_title", () => {
    setupNotificationMock("granted");
    render(<NotificationBell />);

    act(() => {
      socketHandlers["notification:resolution_due"]?.({ payload: "{}" });
    });

    expect(mockNotification).toHaveBeenCalledWith(
      "Vox Populi",
      expect.objectContaining({ body: "Resolution required" }),
    );
  });

  it("does NOT fire Notification when permission is denied", () => {
    setupNotificationMock("denied");
    render(<NotificationBell />);

    act(() => {
      socketHandlers["notification:resolution_due"]?.({
        payload: JSON.stringify({ market_title: "Test" }),
      });
    });

    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("registers and cleans up the socket listener", () => {
    setupNotificationMock("granted");
    const { unmount } = render(<NotificationBell />);

    expect(mockSocket.on).toHaveBeenCalledWith(
      "notification:resolution_due",
      expect.any(Function),
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(
      "notification:resolution_due",
      expect.any(Function),
    );
  });
});
