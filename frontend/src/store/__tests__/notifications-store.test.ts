jest.mock("@/lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));

import { api } from "@/lib/api";
import { useNotificationStore } from "../notifications";

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;
const del = api.delete as jest.Mock;

describe("notification store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNotificationStore.setState({ notifications: [], unreadCount: 0, isOpen: false });
  });

  it("fetches notifications and unread count", async () => {
    get
      .mockResolvedValueOnce({ data: { items: [{ id: "n1", type: "x", payload: null, is_read: false, created_at: "now" }], unread_count: 1 } })
      .mockResolvedValueOnce({ data: { unread_count: 3 } });

    await useNotificationStore.getState().fetch();
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);

    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  it("marks read, marks all read, deletes unread notifications, and toggles UI state", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", type: "x", payload: null, is_read: false, created_at: "now" },
        { id: "n2", type: "x", payload: null, is_read: true, created_at: "now" },
      ],
      unreadCount: 1,
      isOpen: false,
    });
    post.mockResolvedValue({});
    del.mockResolvedValue({});

    await useNotificationStore.getState().markAsRead(["n1"]);
    expect(useNotificationStore.getState().notifications[0].is_read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);

    useNotificationStore.setState({ unreadCount: 2, notifications: useNotificationStore.getState().notifications.map((n) => ({ ...n, is_read: false })) });
    await useNotificationStore.getState().markAllAsRead();
    expect(useNotificationStore.getState().unreadCount).toBe(0);

    useNotificationStore.setState({ unreadCount: 1, notifications: [{ id: "n3", type: "x", payload: null, is_read: false, created_at: "now" }] });
    await useNotificationStore.getState().deleteNotification("n3");
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);

    useNotificationStore.getState().toggle();
    expect(useNotificationStore.getState().isOpen).toBe(true);
    useNotificationStore.getState().close();
    expect(useNotificationStore.getState().isOpen).toBe(false);
  });

  it("ignores fetch failures", async () => {
    get.mockRejectedValue(new Error("offline"));
    await useNotificationStore.getState().fetch();
    await useNotificationStore.getState().fetchUnreadCount();
    expect(useNotificationStore.getState().notifications).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
