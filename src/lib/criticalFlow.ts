// Tracks whether the user is inside a flow that must not be interrupted by
// background activity (currently: the KYC document upload wizard, whose
// forced-reload-on-SW-update bug was a P0 — see vite.config.ts). Consumers
// that poll or trigger side effects on a timer/focus event (main.tsx's PWA
// update checker) should skip while any flow is active.
//
// A ref-counted Set (not a boolean) because two DocumentUploadForm dialogs
// (identity + address) mount simultaneously in KYCSection — closing one must
// not clear the guard while the other is still open.
const activeFlows = new Set<string>();

export function beginCriticalFlow(id: string) {
  activeFlows.add(id);
}

export function endCriticalFlow(id: string) {
  activeFlows.delete(id);
}

export function isCriticalFlowActive(): boolean {
  return activeFlows.size > 0;
}
