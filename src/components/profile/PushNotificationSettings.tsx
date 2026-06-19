import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPermissionState,
  getPushServerConfig,
  getPushSupport,
  setPushDismissed,
} from "@/utils/pushNotifications";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
import { cn } from "@/lib/utils";

type PermissionState = NotificationPermission | "unsupported";

const PushNotificationSettings: React.FC = () => {
  const support = useMemo(() => getPushSupport(), []);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refreshState = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!support.supported) {
        setPermission("unsupported");
        setIsSubscribed(false);
        setServerConfigured(null);
        return;
      }

      const [pushState, config] = await Promise.all([
        getPushPermissionState(),
        getPushServerConfig().catch(() => ({ configured: false })),
      ]);

      if (pushState === "unsupported") {
        setPermission("unsupported");
        setIsSubscribed(false);
      } else {
        setPermission(pushState.permission);
        setIsSubscribed(pushState.subscribed);
      }

      setServerConfigured(config.configured);
    } finally {
      setIsLoading(false);
    }
  }, [support.supported]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const handleToggle = async (checked: boolean) => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (checked) {
        await enablePushNotifications();
        setPushDismissed(false);
        toast.success("Push notifications enabled");
      } else {
        await disablePushNotifications();
        setPushDismissed(true);
        toast.success("Push notifications disabled on this device");
      }

      await refreshState();
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, "Could not update notification settings."));
      await refreshState();
    } finally {
      setIsSaving(false);
    }
  };

  const blocked = permission === "denied";
  const unavailable = !support.supported || serverConfigured === false || blocked;
  const disabled = isLoading || isSaving || unavailable;

  const statusText = (() => {
    if (isLoading) return "Checking this device...";
    if (!support.supported) return support.reason || "Push notifications are not supported here.";
    if (serverConfigured === false) return "Push notifications are not configured on the server yet.";
    if (blocked) return "Notifications are blocked in your browser settings.";
    if (isSubscribed) return "Enabled on this device.";
    return "Off on this device.";
  })();

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Bell className="h-4 w-4 text-[#1B5E20]" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex min-w-0 gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                isSubscribed ? "bg-[#E8F5E9] text-[#1B5E20]" : "bg-white text-gray-500"
              )}
            >
              {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Payment and account alerts</p>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                Receive contribution, withdrawal, KYC, and collection updates on this device.
              </p>
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{statusText}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            <Switch
              checked={isSubscribed}
              disabled={disabled}
              onCheckedChange={handleToggle}
              aria-label="Toggle push notifications on this device"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationSettings;
