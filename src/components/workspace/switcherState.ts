// switcherState.ts — visibility rule for the workspace switcher.
//
// Deliberately a standalone, DEPENDENCY-FREE module. It lives apart from
// WorkspaceSwitcher.tsx so it can be unit-tested without dragging in the store
// and the Supabase client (which requires env vars at module load).

export type SwitcherState = "hidden" | "loading" | "ready";

/**
 * Decide what the switcher shows.
 *
 * THE INVARIANT: for a signed-in user this must NEVER return "hidden".
 *
 * The first implementation returned null whenever no active workspace had
 * resolved, and degraded to inert grey text for anyone with a single
 * workspace — which is every user, since everyone starts with exactly one
 * personal workspace. The feature was therefore invisible in the most common
 * configuration, and was reported as "I am still not seeing anything in the
 * frontend relating to workspace". See workspaceSwitcherState.test.ts.
 */
export function resolveSwitcherState(input: {
  userId?: string | null;
  isLoading?: boolean;
  workspaceCount: number;
}): SwitcherState {
  if (!input.userId) return "hidden"; // signed out — the control has no meaning
  if (input.isLoading && input.workspaceCount === 0) return "loading";
  return "ready"; // ALWAYS interactive, even at zero or one workspace
}
