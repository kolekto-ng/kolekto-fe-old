import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotifications, type AppNotification } from "@/store/useNotifications";

function getUserId(user: unknown): string | null {
  const u = user as { id?: string; user?: { id?: string } } | null;
  return u?.id || u?.user?.id || null;
}

// Backend payloads carry an absolute URL (built with FRONTEND_URL). Convert
// to a router-relative path when it points at our own origin; otherwise fall
// back to a full-page navigation.
function resolveTarget(url: string | null): { path: string | null; external: string | null } {
  if (!url) return { path: null, external: null };
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.origin === window.location.origin) {
        return { path: `${parsed.pathname}${parsed.search}${parsed.hash}`, external: null };
      }
      return { path: null, external: url };
    } catch {
      return { path: null, external: null };
    }
  }
  return { path: url.startsWith("/") ? url : `/${url}`, external: null };
}

const DOT_BY_TONE: Record<string, string> = {
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

function toneFor(notification: AppNotification): string {
  const tone = String((notification.data as { type?: string })?.type || "info");
  return DOT_BY_TONE[tone] || DOT_BY_TONE.info;
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const userId = getUserId(user);

  const notifications = useNotifications((s) => s.notifications);
  const unreadCount = useNotifications((s) => s.unreadCount);
  const isLoading = useNotifications((s) => s.isLoading);
  const fetchNotifications = useNotifications((s) => s.fetchNotifications);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const subscribe = useNotifications((s) => s.subscribe);
  const unsubscribe = useNotifications((s) => s.unsubscribe);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void fetchNotifications(userId);
    subscribe(userId);
    return () => unsubscribe();
  }, [userId, fetchNotifications, subscribe, unsubscribe]);

  const badge = useMemo(
    () => (unreadCount > 99 ? "99+" : String(unreadCount)),
    [unreadCount],
  );

  const handleItemClick = async (notification: AppNotification) => {
    if (!notification.read_at) {
      void markRead(notification.id);
    }
    const { path, external } = resolveTarget(notification.url);
    setOpen(false);
    if (path) {
      navigate(path);
    } else if (external) {
      window.location.href = external;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5 text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 ring-2 ring-white">
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,calc(100vw-1.5rem))] p-0"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900">Notifications</p>
          {unreadCount > 0 && userId && (
            <button
              type="button"
              onClick={() => markAllRead(userId)}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <ScrollArea className="max-h-[60vh]">
          {isLoading && notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Bell className="mx-auto h-7 w-7 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">You're all caught up</p>
              <p className="text-xs text-gray-400">New activity will show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(notification)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex gap-3 transition-colors hover:bg-gray-50",
                      !notification.read_at && "bg-emerald-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        notification.read_at ? "bg-transparent" : toneFor(notification),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm leading-snug",
                            notification.read_at ? "text-gray-700 font-medium" : "text-gray-900 font-semibold",
                          )}
                        >
                          {notification.title}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 leading-snug">
                        {notification.body}
                      </span>
                      <span className="mt-1 block text-[11px] text-gray-400">
                        {relativeTime(notification.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
