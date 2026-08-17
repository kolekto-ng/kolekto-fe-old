// useWorkspaceCapabilities.ts — Workspace Wave 6.6.
//
// One hook the UI asks "may the current user do X here?", answered from the
// capability list the SERVER attached to the active workspace. Components
// must not read `role` and re-derive permissions themselves — that would
// create a second authorization model that drifts from the backend's.
//
// The logic itself lives in utils/workspaceCapabilities.ts (dependency-free,
// unit-tested there); this is the store binding.
//
// ⚠️ COSMETIC ONLY. Every rule these booleans express is already enforced
// server-side (workspaceAuthorizationService + the capability gates added in
// Waves 6.3–6.5). Hiding a control is a courtesy so users aren't shown
// actions that would fail; it is never the thing that stops them.
import { useMemo } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import {
  computeWorkspaceCapabilities,
  type WorkspaceCapabilities,
} from "@/utils/workspaceCapabilities";

export type { WorkspaceCapabilities };

export function useWorkspaceCapabilities(): WorkspaceCapabilities {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useMemo(
    () => computeWorkspaceCapabilities(workspaces, activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );
}

export default useWorkspaceCapabilities;
