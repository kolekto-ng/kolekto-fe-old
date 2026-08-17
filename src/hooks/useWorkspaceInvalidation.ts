// useWorkspaceInvalidation.ts — Workspace Wave 6.2.
//
// Mounts the workspace-switch subscription once, at app root, alongside
// useWorkspaceBootstrap. See store/workspaceInvalidation.ts for why the reset
// lives outside React (a switch must invalidate the data behind every page,
// not just the mounted one) and why cache keys back it up.
import { useEffect } from "react";
import { subscribeWorkspaceInvalidation } from "@/store/workspaceInvalidation";

export function useWorkspaceInvalidation(): void {
  useEffect(() => subscribeWorkspaceInvalidation(), []);
}

export default useWorkspaceInvalidation;
