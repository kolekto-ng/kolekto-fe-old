import React, { useEffect, useMemo } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotifications } from "@/store/useNotifications";

function getUserId(user: unknown): string | null {
  const u = user as { id?: string; user?: { id?: string } } | null;
  return u?.id || u?.user?.id || null;
}

// The bell is just an entry point into the Activities page's "Notifications"
// tab, which renders the full feed (and handles mark-read / navigation). We
// still fetch + subscribe here so the unread badge is live without the
// Activities page having to be mounted.
const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const userId = getUserId(user);

  const unreadCount = useNotifications((s) => s.unreadCount);
  const fetchNotifications = useNotifications((s) => s.fetchNotifications);
  const subscribe = useNotifications((s) => s.subscribe);
  const unsubscribe = useNotifications((s) => s.unsubscribe);

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

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      onClick={() => navigate("/dashboard/activities")}
    >
      <Bell className="h-5 w-5 text-gray-600" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 ring-2 ring-white">
          {badge}
        </span>
      )}
    </Button>
  );
};

export default NotificationCenter;
