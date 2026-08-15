// WorkspacePage.tsx — Workspace management surface (Phase 8 frontend, Wave 4
// invitations).
//
// Covers: viewing the active workspace, editing its settings, listing every
// workspace the user belongs to, creating a new (non-personal) one, and (as
// of Wave 4) inviting people into it. Backend authorization
// (workspace:members.manage) remains authoritative — the `canUpdate` check
// below is presentation only, same disclaimer as the rest of this file's
// store.
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Loader2, Mail, Plus, ShieldCheck, User, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useWorkspaceStore,
  type WorkspaceType,
  type WorkspaceInvite,
  type WorkspaceMember,
} from "@/store/useWorkspaceStore";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "@/lib/toast";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

/** Types a user may create. `personal` is excluded — the DB provisions exactly one. */
const CREATABLE_TYPES: { value: WorkspaceType; label: string; hint: string }[] = [
  { value: "association", label: "Association", hint: "Student bodies, alumni groups, unions" },
  { value: "organization", label: "Organization", hint: "NGOs, churches, cooperatives, businesses" },
  { value: "community", label: "Community", hint: "Neighbourhood or interest groups" },
  { value: "event", label: "Event", hint: "Weddings, conferences, one-off gatherings" },
  { value: "group", label: "Group", hint: "Anything else — a set of people collecting together" },
];

/** Roles that may edit workspace settings — mirrors the backend capability map. */
const CAN_UPDATE_ROLES = ["OWNER", "ADMIN"];

/** Display label for a member; falls back through name → email → "this member". */
function memberLabel(member: WorkspaceMember) {
  return member.full_name || member.email || "this member";
}

/**
 * What a pending removal points at. Deliberately NOT a WorkspaceMember: a
 * plain MEMBER leaving has no roster row available (the roster requires
 * workspace:members.manage), only their own membership_id from GET /workspaces.
 */
type RemovalTarget = { memberId: string; userId: string | null; label: string };

function WorkspaceTypeBadge({ type }: { type: string }) {
  if (type === "personal") {
    return (
      <Badge variant="secondary" className="gap-1">
        <User className="h-3 w-3" aria-hidden="true" /> Personal
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 capitalize">
      <Building2 className="h-3 w-3" aria-hidden="true" /> {type}
    </Badge>
  );
}

export default function WorkspacePage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const storeError = useWorkspaceStore((s) => s.error);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const pendingInvites = useWorkspaceStore((s) => s.pendingInvites);
  const invitesLoading = useWorkspaceStore((s) => s.invitesLoading);
  const fetchPendingInvites = useWorkspaceStore((s) => s.fetchPendingInvites);
  const createInvite = useWorkspaceStore((s) => s.createInvite);
  const revokeInvite = useWorkspaceStore((s) => s.revokeInvite);
  const members = useWorkspaceStore((s) => s.members);
  const membersLoading = useWorkspaceStore((s) => s.membersLoading);
  const membersError = useWorkspaceStore((s) => s.membersError);
  const fetchMembers = useWorkspaceStore((s) => s.fetchMembers);
  const changeMemberRole = useWorkspaceStore((s) => s.changeMemberRole);
  const suspendMember = useWorkspaceStore((s) => s.suspendMember);
  const reactivateMember = useWorkspaceStore((s) => s.reactivateMember);
  const removeMember = useWorkspaceStore((s) => s.removeMember);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const userId = (useAuthStore() as any)?.user?.id;

  const active = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const canUpdate = !!active?.role && CAN_UPDATE_ROLES.includes(active.role);

  // ── Settings form ─────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed the form whenever the active workspace changes, so switching
  // workspaces never leaves another workspace's text in the inputs.
  useEffect(() => {
    setName(active?.name ?? "");
    setDescription(active?.description ?? "");
  }, [active?.id, active?.name, active?.description]);

  const dirty =
    !!active && (name.trim() !== (active.name ?? "") || description !== (active.description ?? ""));

  const handleSave = async () => {
    if (!active || !dirty) return;
    setSaving(true);
    try {
      await updateWorkspace(active.id, { name: name.trim(), description });
      toast.success("Workspace updated");
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err, "Could not update workspace."));
    } finally {
      setSaving(false);
    }
  };

  // ── Create dialog ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<WorkspaceType | "">("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Invitations (Wave 4) ─────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || active.type === "personal") return;
    fetchPendingInvites(active.id).catch(() => {
      // Swallowed by design, matching this page's own error-state pattern for
      // secondary data — the workspace itself already loaded; a failed
      // invites fetch must not block the rest of the page. The empty list
      // renders instead, and the user can retry by switching away and back.
    });
  }, [active?.id, active?.type, fetchPendingInvites]);

  const handleInvite = async () => {
    if (!active || !inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      await createInvite(active.id, { email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      setInviteRole("MEMBER");
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err, "Could not send invitation."));
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevoke = async (invite: WorkspaceInvite) => {
    if (!active) return;
    setRevokingId(invite.id);
    try {
      await revokeInvite(active.id, invite.id);
      toast.success(`Invitation to ${invite.email} revoked`);
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err, "Could not revoke invitation."));
    } finally {
      setRevokingId(null);
    }
  };

  // ── Members (Wave 5) ─────────────────────────────────────────────────────
  // `canUpdate` gates which controls RENDER. It is presentation only: the
  // backend re-checks workspace:members.manage on every request, and OWNER
  // protection plus the self-action rules are enforced in the database.
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  // Minimal descriptor rather than a WorkspaceMember, because a plain MEMBER
  // leaving has no roster row to point at — only their own membership_id.
  const [removeTarget, setRemoveTarget] = useState<RemovalTarget | null>(null);
  const [removing, setRemoving] = useState(false);

  /** The caller's own membership id for the active workspace, if known. */
  const selfMembershipId = active?.membership_id ?? null;
  /** A non-OWNER member may always leave; an OWNER never can (backend-enforced). */
  const canLeaveActiveWorkspace =
    !!active && active.type !== "personal" && active.role !== "OWNER" && !!selfMembershipId;

  // Only managers may read the roster: GET /members requires
  // workspace:members.manage, so fetching it as a plain MEMBER would return a
  // guaranteed 403 and surface a permission error for simply opening the page.
  // A MEMBER needs no roster — their own membership_id (from GET /workspaces)
  // is all the leave action requires. `canUpdate` here is a render decision,
  // not an authorization one; the backend re-checks regardless.
  useEffect(() => {
    if (!active || active.type === "personal" || !canUpdate) return;
    fetchMembers(active.id).catch(() => {
      // Swallowed here by design: membersError is already set by the store and
      // rendered inline below, matching this page's pattern for secondary data.
    });
  }, [active?.id, active?.type, canUpdate, fetchMembers]);

  const handleRoleChange = async (member: WorkspaceMember, role: "ADMIN" | "MEMBER") => {
    if (!active) return;
    setMemberBusyId(member.id);
    try {
      await changeMemberRole(active.id, member.id, role);
      toast.success(`${memberLabel(member)} is now ${role}`);
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err, "Could not change this member's role."));
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleToggleStatus = async (member: WorkspaceMember) => {
    if (!active) return;
    const suspending = member.status === "active";
    setMemberBusyId(member.id);
    try {
      if (suspending) {
        await suspendMember(active.id, member.id);
        toast.success(`${memberLabel(member)} suspended`);
      } else {
        await reactivateMember(active.id, member.id);
        toast.success(`${memberLabel(member)} reactivated`);
      }
    } catch (err) {
      toast.error(
        toFriendlyErrorMessage(
          err,
          suspending ? "Could not suspend this member." : "Could not reactivate this member."
        )
      );
    } finally {
      setMemberBusyId(null);
    }
  };

  const handleConfirmRemove = async () => {
    if (!active || !removeTarget) return;
    const leaving = removeTarget.userId === userId;
    setRemoving(true);
    try {
      await removeMember(active.id, removeTarget.memberId);
      toast.success(leaving ? `You left ${active.name}` : `${removeTarget.label} removed`);
      setRemoveTarget(null);
      // Leaving revokes your own access — refresh the workspace list so the
      // switcher and active-workspace selection stop pointing at a workspace
      // the server will no longer return.
      if (leaving) await fetchWorkspaces(userId);
    } catch (err) {
      toast.error(
        toFriendlyErrorMessage(
          err,
          leaving ? "Could not leave this workspace." : "Could not remove this member."
        )
      );
    } finally {
      setRemoving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newType) return;
    setCreating(true);
    try {
      const ws = await createWorkspace(
        { name: newName.trim(), type: newType as WorkspaceType, description: newDescription },
        userId
      );
      toast.success(`${ws.name} created — you're now in it`);
      setCreateOpen(false);
      setNewName("");
      setNewType("");
      setNewDescription("");
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err, "Could not create workspace."));
    } finally {
      setCreating(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading && workspaces.length === 0) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // ── Error state (only when we have nothing to show) ───────────────────────
  if (storeError && workspaces.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load your workspaces</CardTitle>
            <CardDescription>{storeError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            A workspace is who you're collecting as. Every collection belongs to one.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" aria-hidden="true" /> New workspace
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Use this for an association, event, or organization you collect money for.
                Your personal workspace already exists and can't be recreated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name">Name</Label>
                <Input
                  id="ws-name"
                  value={newName}
                  maxLength={80}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. FASSA Alumni"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-type">Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as WorkspaceType)}>
                  <SelectTrigger id="ws-type">
                    <SelectValue placeholder="What kind of group is this?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATABLE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="font-medium">{t.label}</span>
                        <span className="block text-xs text-muted-foreground">{t.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ws-desc">Description (optional)</Label>
                <Textarea
                  id="ws-desc"
                  value={newDescription}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What does this group collect for?"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || !newType || creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Create workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active workspace + settings */}
      {active && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{active.name}</CardTitle>
              <WorkspaceTypeBadge type={active.type} />
              {active.role && (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> {active.role}
                </Badge>
              )}
            </div>
            <CardDescription>
              {active.type === "personal"
                ? "Your personal workspace. Collections you create on your own live here."
                : "Collections created while this workspace is active belong to it."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="active-name">Workspace name</Label>
              <Input
                id="active-name"
                value={name}
                maxLength={80}
                disabled={!canUpdate || saving}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="active-desc">Description</Label>
              <Textarea
                id="active-desc"
                value={description}
                maxLength={500}
                rows={3}
                disabled={!canUpdate || saving}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>

            {!canUpdate && (
              <p className="text-sm text-muted-foreground">
                You don't have permission to change this workspace's settings.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!canUpdate || !dirty || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invitations — org-type workspaces only; a personal workspace is
          deliberately single-user, so there is nothing to invite anyone into
          there (the backend does not structurally block it, but the product
          surface only exposes it here). */}
      {active && active.type !== "personal" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitations</CardTitle>
            <CardDescription>
              {canUpdate
                ? "Invite someone by email. They'll be able to accept once they sign in with that address."
                : "You don't have permission to manage invitations for this workspace."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canUpdate && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={sendingInvite}
                  className="sm:flex-1"
                  aria-label="Invite email address"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "ADMIN" | "MEMBER")}>
                  <SelectTrigger className="sm:w-32" aria-label="Invite role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={!inviteEmail.trim() || sendingInvite} className="sm:w-auto">
                  {sendingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Send invitation
                </Button>
              </div>
            )}

            {invitesLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <ul className="space-y-2">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{invite.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {invite.role} · expires {new Date(invite.expires_at).toLocaleDateString()}
                        </span>
                      </span>
                    </span>
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(invite)}
                        disabled={revokingId === invite.id}
                        aria-label={`Revoke invitation to ${invite.email}`}
                      >
                        {revokingId === invite.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <X className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Your membership (Wave 5) — shown to non-managers, who cannot read the
          roster below (GET /members requires workspace:members.manage). This is
          the plain MEMBER's route to leaving a workspace; it needs nothing but
          their own membership_id, already present from GET /workspaces. */}
      {active && active.type !== "personal" && !canUpdate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your membership</CardTitle>
            <CardDescription>Your role in {active.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex min-w-0 items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">You</span>
                <Badge variant="outline">{active.role ?? "MEMBER"}</Badge>
              </span>
              {canLeaveActiveWorkspace && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRemoveTarget({
                      memberId: selfMembershipId as string,
                      userId,
                      label: "you",
                    })
                  }
                >
                  Leave workspace
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members roster (Wave 5) — managers only; see the fetch guard above. */}
      {active && active.type !== "personal" && canUpdate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>
              People who belong to {active.name}. The workspace owner cannot be changed or removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {membersLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : membersError ? (
              <div className="rounded-lg border border-destructive/40 p-3">
                <p className="text-sm text-destructive">{membersError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fetchMembers(active.id).catch(() => {})}
                >
                  Try again
                </Button>
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((member) => {
                  const isOwner = member.role === "OWNER";
                  const isSelf = member.user_id === userId;
                  const busy = memberBusyId === member.id;
                  // OWNER is protected server-side; never render controls that
                  // the backend is guaranteed to reject. Self-role-change and
                  // self-suspend are likewise rejected server-side, so only the
                  // "leave" action is offered on your own row.
                  const canManageThis = canUpdate && !isOwner && !isSelf;
                  const canLeave = isSelf && !isOwner;

                  return (
                    <li
                      key={member.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {member.full_name || member.email || "Unknown member"}
                            {isSelf && (
                              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                            )}
                          </span>
                          {member.email && member.full_name && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {member.email}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant={isOwner ? "default" : "outline"}>{member.role}</Badge>
                        {member.status === "suspended" && (
                          <Badge variant="secondary">Suspended</Badge>
                        )}

                        {isOwner ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Protected
                          </span>
                        ) : (
                          <>
                            {canManageThis && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    handleRoleChange(
                                      member,
                                      member.role === "ADMIN" ? "MEMBER" : "ADMIN"
                                    )
                                  }
                                >
                                  {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                  ) : member.role === "ADMIN" ? (
                                    "Change to MEMBER"
                                  ) : (
                                    "Promote to ADMIN"
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => handleToggleStatus(member)}
                                >
                                  {member.status === "active" ? "Suspend" : "Reactivate"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    setRemoveTarget({
                                      memberId: member.id,
                                      userId: member.user_id,
                                      label: memberLabel(member),
                                    })
                                  }
                                  aria-label={`Remove ${memberLabel(member)}`}
                                >
                                  <X className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </>
                            )}
                            {canLeave && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() =>
                                  setRemoveTarget({
                                    memberId: member.id,
                                    userId: member.user_id,
                                    label: memberLabel(member),
                                  })
                                }
                              >
                                Leave workspace
                              </Button>
                            )}
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Remove / leave confirmation — destructive, so it always confirms. */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removeTarget?.userId === userId
                ? "Leave workspace?"
                : `Remove ${removeTarget?.label ?? "this member"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.userId === userId
                ? "You will lose access to this workspace and its collections. You'll need a new invitation to rejoin."
                : "They will lose access to this workspace and its collections. You can invite them again later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={removing}
              onClick={(e) => {
                // Keep the dialog mounted while the request is in flight so the
                // busy state is visible; handleConfirmRemove closes it on success.
                e.preventDefault();
                void handleConfirmRemove();
              }}
            >
              {removing
                ? "Working..."
                : removeTarget?.userId === userId
                  ? "Leave workspace"
                  : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* All workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your workspaces</CardTitle>
          <CardDescription>Switch to change which workspace you're working in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaces.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">
                No workspaces yet. Create one to get started.
              </p>
            </div>
          ) : (
            workspaces.map((w) => {
              const isActive = w.id === activeWorkspaceId;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => switchWorkspace(w.id, userId)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{w.name}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <WorkspaceTypeBadge type={w.type} />
                      {w.role && (
                        <span className="text-xs text-muted-foreground">{w.role}</span>
                      )}
                    </span>
                  </span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
