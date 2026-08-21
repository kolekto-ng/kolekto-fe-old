// WorkspaceSwitcher.tsx — the "who am I collecting as?" control.
//
// DESIGN NOTE (rewritten 2026-08-12). The first version hid itself: it returned
// null until workspaces loaded, and rendered a plain grey text label whenever
// the user had fewer than two workspaces — which is EVERY user today, since
// everyone starts with exactly one personal workspace. The result was a feature
// nobody could see. Avoiding a "dead dropdown" is not worth making the whole
// concept invisible.
//
// It is now always a real, tappable control:
//   • loading            → skeleton in the same shape (no layout shift)
//   • one workspace      → still opens, offering Create / Manage
//   • many workspaces    → full list with the active one check-marked
//
// Two variants so it fits both mounts without duplicating logic:
//   "full"    — sidebar header. Avatar + name + type. The primary, discoverable
//               home for workspace identity (the Slack/Notion pattern).
//   "compact" — top navbar. Avatar + name only, for tight horizontal space.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Settings2, Building2, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceStore, type Workspace } from "@/store/useWorkspaceStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/lib/toast";
import { resolveSwitcherState } from "./switcherState";

interface Props {
  className?: string;
  variant?: "full" | "compact";
}

// Visibility rule lives in its own dependency-free module so it is unit-testable
export type { SwitcherState } from "./switcherState";

/** Coloured initial tile — gives the control visual weight so it reads as UI. */
function WorkspaceAvatar({ name, type, size = "md" }: { name: string; type: string; size?: "sm" | "md" }) {
  const initial = (name?.trim()?.[0] ?? "W").toUpperCase();
  const dim = size === "sm" ? "h-6 w-6 text-[11px]" : "h-8 w-8 text-xs";
  // Personal stays neutral; collaborative workspaces take the Kolekto green so
  // "acting as an organization" is visually distinct at a glance.
  const tone =
    type === "personal"
      ? "bg-gray-200 text-gray-700"
      : "bg-[#1B5E20] text-white";
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-md font-semibold ${tone}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function WorkspaceSwitcher({ className, variant = "compact" }: Props) {
  const navigate = useNavigate();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const user = (useAuthStore() as any)?.user;
  const userId = user?.id;

  const active = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const state = resolveSwitcherState({
    userId,
    isLoading,
    workspaceCount: workspaces.length,
  });

  /**
   * IMMEDIATE ACKNOWLEDGEMENT (performance wave, 2026-08-20).
   *
   * `switchWorkspace` is a synchronous zustand write, so the check mark and
   * the trigger label already move within the same frame — the sub-100 ms
   * response the brief asks for was in place. What was missing was
   * acknowledgement that persisted past the dropdown closing: the menu
   * disappears, and the user is left watching sections reload with no
   * statement of what they are now looking at.
   *
   * This names the destination explicitly. It is a UI confirmation of a
   * LOCAL state change that has already happened, not a claim about any
   * server call — no request has been made yet, and nothing here asserts
   * success of one. Re-selecting the active workspace is a no-op and stays
   * silent rather than toasting a switch that did not occur.
   */
  const handleSelect = (workspace: Workspace) => {
    if (workspace.id === activeWorkspaceId) return;
    switchWorkspace(workspace.id, userId);
    toast.info(`Switched to ${workspace.name}`, {
      description: "Loading this workspace's collections, wallet and activity…",
    });
  };

  if (state === "hidden") return null;

  const isFull = variant === "full";

  // Loading: keep the footprint so the layout does not jump when it resolves.
  if (state === "loading") {
    return (
      <div className={`flex items-center gap-2 ${className ?? ""}`}>
        <Skeleton className={isFull ? "h-8 w-8 rounded-md" : "h-6 w-6 rounded-md"} />
        <Skeleton className={isFull ? "h-4 w-28" : "h-4 w-20"} />
      </div>
    );
  }

  // Loaded but empty (bootstrap failed or still healing) — still show an entry
  // point rather than a blank space, so the feature is never invisible.
  const label = active?.name ?? "Personal workspace";
  const type = active?.type ?? "personal";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Current workspace: ${label}. Change workspace`}
          className={[
            "group flex items-center gap-2 rounded-lg border border-gray-200 bg-white text-left",
            "transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E20]/40",
            isFull ? "w-full px-2.5 py-2" : "max-w-[220px] px-2 py-1.5",
            className ?? "",
          ].join(" ")}
        >
          <WorkspaceAvatar name={label} type={type} size={isFull ? "md" : "sm"} />
          <span className="min-w-0 flex-1">
            <span
              className={`block truncate font-medium text-gray-900 ${isFull ? "text-sm" : "text-[13px]"}`}
            >
              {label}
            </span>
            {isFull && (
              <span className="block truncate text-[11px] capitalize text-gray-500">
                {type === "personal" ? "Personal workspace" : `${type} workspace`}
              </span>
            )}
          </span>
          <ChevronsUpDown
            className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-gray-600"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Collecting as
        </DropdownMenuLabel>

        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => handleSelect(w)}
            className="flex items-center gap-2"
          >
            <WorkspaceAvatar name={w.name} type={w.type} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{w.name}</span>
              <span className="block truncate text-[11px] capitalize text-muted-foreground">
                {w.type === "personal" ? "Personal" : w.type}
                {w.role ? ` · ${w.role.toLowerCase()}` : ""}
              </span>
            </span>
            {w.id === activeWorkspaceId && (
              <Check className="h-4 w-4 shrink-0 text-[#1B5E20]" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}

        {workspaces.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            No workspaces loaded yet.
          </div>
        )}

        <DropdownMenuSeparator />

        {/* Always available — this is what makes a single-workspace dropdown
            worth opening, and it is the discovery path for the whole feature. */}
        <DropdownMenuItem onSelect={() => navigate("/dashboard/workspace")} className="gap-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">Create workspace</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/dashboard/workspace")} className="gap-2">
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">Manage workspaces</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WorkspaceSwitcher;

/** Small inline badge for showing workspace context on content pages. */
export function ActiveWorkspaceBadge({ className }: { className?: string }) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  if (!active) return null;

  const Icon = active.type === "personal" ? User : Building2;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#1B5E20]/8 px-2.5 py-1 text-xs font-medium text-[#1B5E20] ${className ?? ""}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="max-w-[180px] truncate">{active.name}</span>
    </span>
  );
}
