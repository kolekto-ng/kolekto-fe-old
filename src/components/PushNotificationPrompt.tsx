import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, Smartphone } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  enablePushNotifications,
  getExistingPushSubscription,
  getPushDismissed,
  getPushServerConfig,
  getPushSupport,
  setPushDismissed,
} from "@/utils/pushNotifications";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";
import { cn } from "@/lib/utils";

type PromptState = "checking" | "hidden" | "visible" | "unsupported" | "enabled";

const PushNotificationPrompt: React.FC = () => {
  const [state, setState] = useState<PromptState>("checking");
  const [isEnabling, setIsEnabling] = useState(false);
  const support = useMemo(() => getPushSupport(), []);

  useEffect(() => {
    let mounted = true;

    async function checkPromptState() {
      if (!support.supported) {
        if (support.needsInstall && !getPushDismissed()) {
          setState("unsupported");
        } else {
          setState("hidden");
        }
        return;
      }

      if (Notification.permission === "denied" || getPushDismissed()) {
        setState("hidden");
        return;
      }

      const config = await getPushServerConfig().catch(() => ({ configured: false }));
      if (!mounted) return;
      if (!config.configured) {
        setState("hidden");
        return;
      }

      const subscription = await getExistingPushSubscription().catch(() => null);
      if (!mounted) return;
      if (subscription || Notification.permission === "granted") {
        // Re-save the endpoint for the current authenticated user on every
        // dashboard session. This repairs lost backend rows, account switches,
        // and VAPID rotations without asking for permission a second time.
        const synced = await enablePushNotifications().catch(() => null);
        if (!mounted) return;
        setState(synced ? "enabled" : "visible");
        return;
      }

      setState("visible");
    }

    checkPromptState();
    return () => {
      mounted = false;
    };
  }, [support.needsInstall, support.supported]);

  const dismiss = () => {
    setPushDismissed(true);
    setState("hidden");
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await enablePushNotifications();
      setState("enabled");
      toast.success("Notifications enabled");
    } catch (error) {
      toast.error(toFriendlyErrorMessage(error, "Could not enable notifications. Please try again."));
    } finally {
      setIsEnabling(false);
    }
  };

  if (state === "checking" || state === "hidden" || state === "enabled") {
    return null;
  }

  const isUnsupported = state === "unsupported";

  return (
    <div className="fixed left-0 right-0 top-16 z-50 pointer-events-none px-3 sm:px-6 lg:px-8">
      <section
        aria-live="polite"
        className={cn(
          "pointer-events-auto mx-auto max-w-3xl rounded-xl border border-emerald-100 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.08)]",
          "sm:p-4",
          "animate-in fade-in-0 slide-in-from-top-2 duration-200"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto">
            {isUnsupported ? <Smartphone className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5 text-slate-950">
                  {isUnsupported ? "Install Kolekto for alerts" : "Get payment updates"}
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
                  {isUnsupported
                    ? support.reason
                    : "Receive collection, withdrawal, KYC, and payment updates on this device."}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={dismiss}
                  className="h-10 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <BellOff className="mr-2 h-4 w-4" />
                  Not now
                </Button>

                {!isUnsupported && (
                  <Button
                    type="button"
                    onClick={handleEnable}
                    disabled={isEnabling}
                    className="h-10 rounded-lg bg-kolekto px-4 text-sm font-semibold text-white shadow-sm hover:bg-kolekto/90"
                  >
                    {isEnabling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Enable
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PushNotificationPrompt;
