import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

const FETCH_LIMIT = 30;

// The `notifications` table is written by the backend service role on every
// push event (see kolekto-be-old/utils/pushNotifications.js). The frontend
// reads its own rows via RLS and subscribes to realtime so the badge and
// feed update live — mirroring the activities realtime wiring already used
// in DashboardNavbar.
//
// `supabase` is typed against the generated Database, which does not yet
// include this table, so reads/writes go through a narrow typed handle that
// only models the query surface this store actually uses.
type QueryOutcome<T> = PromiseLike<{ data: T | null; error: { message?: string } | null }>;

interface NotifQuery extends QueryOutcome<AppNotification[]> {
  select: (columns: string) => NotifQuery;
  update: (values: Record<string, unknown>) => NotifQuery;
  eq: (column: string, value: string) => NotifQuery;
  is: (column: string, value: null) => NotifQuery;
  order: (column: string, options: { ascending: boolean }) => NotifQuery;
  limit: (count: number) => NotifQuery;
}

interface NotifChannel {
  on: (
    event: "postgres_changes",
    filter: { event: string; schema: string; table: string; filter: string },
    callback: (payload: { new: AppNotification }) => void,
  ) => NotifChannel;
  subscribe: () => NotifChannel;
}

const db = supabase as unknown as {
  from: (table: string) => NotifQuery;
  channel: (name: string) => NotifChannel;
  removeChannel: (channel: unknown) => void;
};

const countUnread = (rows: AppNotification[]) =>
  rows.reduce((total, row) => (row.read_at ? total : total + 1), 0);

const upsertRow = (rows: AppNotification[], incoming: AppNotification) => {
  const index = rows.findIndex((row) => row.id === incoming.id);
  if (index === -1) return [incoming, ...rows].slice(0, 100);
  const next = rows.slice();
  next[index] = { ...next[index], ...incoming };
  return next;
};

type NotificationsState = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: unknown;
  subscribedFor: string | null;
  channel: unknown;
  fetchNotifications: (userId: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  subscribe: (userId: string) => void;
  unsubscribe: () => void;
};

export const useNotifications = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  subscribedFor: null,
  channel: null,

  fetchNotifications: async (userId: string) => {
    if (!userId) return;
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await db
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (error) throw error;
      const rows = (Array.isArray(data) ? data : []) as AppNotification[];
      set({ notifications: rows, unreadCount: countUnread(rows), isLoading: false });
    } catch (error) {
      console.error("Notifications fetch error:", error);
      set({ isLoading: false, error });
    }
  },

  markRead: async (id: string) => {
    if (!id) return;
    const { notifications } = get();
    const target = notifications.find((row) => row.id === id);
    if (!target || target.read_at) return; // already read — no-op

    const readAt = new Date().toISOString();
    // Optimistic update so the badge responds immediately.
    const optimistic = notifications.map((row) =>
      row.id === id ? { ...row, read_at: readAt } : row,
    );
    set({ notifications: optimistic, unreadCount: countUnread(optimistic) });

    const { error } = await db
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", id)
      .is("read_at", null);
    if (error) {
      console.error("Notification markRead error:", error);
      // Revert on failure.
      set({ notifications, unreadCount: countUnread(notifications) });
    }
  },

  markAllRead: async (userId: string) => {
    if (!userId) return;
    const { notifications } = get();
    if (!notifications.some((row) => !row.read_at)) return;

    const readAt = new Date().toISOString();
    const optimistic = notifications.map((row) =>
      row.read_at ? row : { ...row, read_at: readAt },
    );
    set({ notifications: optimistic, unreadCount: 0 });

    const { error } = await db
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .is("read_at", null);
    if (error) {
      console.error("Notification markAllRead error:", error);
      set({ notifications, unreadCount: countUnread(notifications) });
    }
  },

  subscribe: (userId: string) => {
    if (!userId) return;
    const { subscribedFor, channel } = get();
    if (subscribedFor === userId && channel) return; // already live
    if (channel) {
      db.removeChannel(channel);
    }

    const live = db
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: { new: AppNotification }) => {
          const rows = upsertRow(get().notifications, payload.new);
          set({ notifications: rows, unreadCount: countUnread(rows) });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload: { new: AppNotification }) => {
          const rows = upsertRow(get().notifications, payload.new);
          set({ notifications: rows, unreadCount: countUnread(rows) });
        },
      )
      .subscribe();

    set({ channel: live, subscribedFor: userId });
  },

  unsubscribe: () => {
    const { channel } = get();
    if (channel) db.removeChannel(channel);
    set({ channel: null, subscribedFor: null });
  },
}));
