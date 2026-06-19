export type PwaUpdateState = {
  needRefresh: boolean;
  offlineReady: boolean;
  isUpdating: boolean;
  lastCheckedAt: number | null;
  updateReadyAt: number | null;
};

const PWA_EVENT_NAME = "kolekto:pwa-update-state";

let currentState: PwaUpdateState = {
  needRefresh: false,
  offlineReady: false,
  isUpdating: false,
  lastCheckedAt: null,
  updateReadyAt: null,
};

let updateServiceWorker:
  | ((reloadPage?: boolean) => Promise<void>)
  | null = null;

function emitState() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PwaUpdateState>(PWA_EVENT_NAME, {
      detail: currentState,
    }),
  );
}

export function getPwaUpdateState() {
  return currentState;
}

export function setPwaUpdateState(nextState: Partial<PwaUpdateState>) {
  currentState = {
    ...currentState,
    ...nextState,
  };
  emitState();
}

export function subscribeToPwaUpdateState(
  callback: (state: PwaUpdateState) => void,
) {
  if (typeof window === "undefined") {
    callback(currentState);
    return () => undefined;
  }

  const listener = (event: Event) => {
    callback((event as CustomEvent<PwaUpdateState>).detail);
  };

  callback(currentState);
  window.addEventListener(PWA_EVENT_NAME, listener);

  return () => {
    window.removeEventListener(PWA_EVENT_NAME, listener);
  };
}

export function registerPwaUpdater(
  updater: (reloadPage?: boolean) => Promise<void>,
) {
  updateServiceWorker = updater;
}

export async function applyPwaUpdate() {
  if (!updateServiceWorker) return false;

  setPwaUpdateState({ isUpdating: true });

  try {
    await updateServiceWorker(true);
    return true;
  } finally {
    setPwaUpdateState({ isUpdating: false });
  }
}
