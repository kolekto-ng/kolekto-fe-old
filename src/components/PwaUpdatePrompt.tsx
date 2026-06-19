import React, { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyPwaUpdate,
  getPwaUpdateState,
  subscribeToPwaUpdateState,
  type PwaUpdateState,
} from "@/lib/pwaUpdates";

const DISMISS_KEY = "kolekto-pwa-update-dismissed-at";

function wasDismissedAfter(updateReadyAt: number | null) {
  if (!updateReadyAt) return false;

  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return dismissedAt >= updateReadyAt;
}

const PwaUpdatePrompt: React.FC = () => {
  const [state, setState] = useState<PwaUpdateState>(() => getPwaUpdateState());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPwaUpdateState((nextState) => {
      setState(nextState);

      if (nextState.needRefresh) {
        setIsDismissed(wasDismissedAfter(nextState.updateReadyAt));
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!state.needRefresh) {
      setIsDismissed(false);
      return;
    }

    setIsDismissed(wasDismissedAfter(state.updateReadyAt));
  }, [state.needRefresh, state.updateReadyAt]);

  const dismiss = () => {
    localStorage.setItem(
      DISMISS_KEY,
      String(state.updateReadyAt || Date.now()),
    );
    setIsDismissed(true);
  };

  const handleUpdate = async () => {
    await applyPwaUpdate();
  };

  const showUpdatePrompt = state.needRefresh && !isDismissed;
  const showOfflineReady = state.offlineReady && !state.needRefresh;

  if (!showUpdatePrompt && !showOfflineReady) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-3 sm:bottom-5 sm:px-6">
      <section className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.12)] sm:p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-kolekto">
          {showUpdatePrompt ? (
            <RefreshCw className={`h-5 w-5 ${state.isUpdating ? "animate-spin" : ""}`} />
          ) : (
            <WifiOff className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">
            {showUpdatePrompt ? "New update available" : "Offline mode ready"}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {showUpdatePrompt
              ? "Refresh now to load the latest Kolekto build on this device."
              : "Kolekto can keep working even when your connection drops."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {showUpdatePrompt ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={dismiss}
                className="h-10 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Later
              </Button>
              <Button
                type="button"
                onClick={handleUpdate}
                disabled={state.isUpdating}
                className="h-10 rounded-xl bg-kolekto px-4 text-sm font-semibold text-white hover:bg-kolekto/90"
              >
                {state.isUpdating ? "Updating..." : "Refresh"}
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setState((prev) => ({ ...prev, offlineReady: false }))}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss offline ready message"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default PwaUpdatePrompt;
