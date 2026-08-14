// InvitePage.tsx — Workspace invitation accept/decline (Workspace Wave 4).
//
// Reachable BEFORE authentication (design doc §9/§X) — the preview loads for
// anyone with the link. Accepting/declining requires a signed-in session
// whose email matches the invitation; unauthenticated visitors are sent to
// login/register with a `redirect` back to this exact page, mirroring
// CollectionTransferPage.tsx's established pattern (the closest existing
// precedent for "public token-based accept flow" in this codebase) rather
// than inventing a new auth-continuation mechanism.
//
// Deliberately does NOT reveal which email an invalid/unknown/expired/
// revoked token was for pre-authentication — the backend's preview endpoint
// already returns an identical generic shape for all of those (see
// workspaceInvitationService.previewInvite's own comment); this page must
// not try to be smarter than the API it's calling.
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail, Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useWorkspaceStore,
  previewInviteByToken,
  declineInviteByToken,
  type InvitePreview,
} from "@/store/useWorkspaceStore";
import { toast } from "@/lib/toast";
import { toFriendlyErrorMessage } from "@/utils/errorMessages";

type ViewState =
  | "loading"
  | "invalid"
  | "needsAuth"
  | "wrongEmail"
  | "ready"
  | "processing"
  | "accepted"
  | "declined"
  | "expired"
  | "error";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuthStore() as any;
  const acceptInviteAndActivate = useWorkspaceStore((s) => s.acceptInviteAndActivate);

  const [view, setView] = useState<ViewState>("loading");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load the (deliberately generic) preview once, regardless of auth state —
  // it's public. Auth state only affects what happens NEXT, not this fetch.
  useEffect(() => {
    if (!token) {
      setView("invalid");
      return;
    }
    let cancelled = false;
    previewInviteByToken(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview({ valid: false });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Decide the actual view once BOTH the preview and auth state are settled.
  useEffect(() => {
    if (authLoading || !preview) return; // still resolving — stay on "loading"
    if (!preview.valid) {
      setView("invalid");
      return;
    }
    if (!user) {
      setView("needsAuth");
      return;
    }
    setView("ready");
  }, [authLoading, preview, user]);

  const goToAuth = (mode: "login" | "register") => {
    if (!token) return;
    const redirect = encodeURIComponent(`/invite/${token}`);
    navigate(`/${mode === "login" ? "login" : "register"}?redirect=${redirect}`);
  };

  const handleAccept = async () => {
    if (!token) return;
    setView("processing");
    try {
      // acceptInviteAndActivate handles the accept -> fetchWorkspaces ->
      // switchWorkspace ordering internally (see useWorkspaceStore.ts) —
      // this page does not need to (and must not) re-implement that sequence.
      await acceptInviteAndActivate(token, user?.id);
      toast.success(`You've joined ${preview?.workspaceName ?? "the workspace"}`);
      setView("accepted");
    } catch (err: any) {
      // `err.code` on an axios error is axios's OWN transport code (e.g.
      // "ERR_BAD_REQUEST"), not the backend's business error code — that
      // lives at err.response.data.code. Using `err.code` first would
      // silently shadow every real backend code with axios's generic one.
      const code = err?.response?.data?.code;
      if (code === "EMAIL_MISMATCH") {
        setView("wrongEmail");
      } else if (code === "INVITE_EXPIRED") {
        setView("expired");
      } else {
        setErrorMsg(toFriendlyErrorMessage(err, "This invitation could not be accepted."));
        setView("error");
      }
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    setView("processing");
    try {
      await declineInviteByToken(token);
      setView("declined");
    } catch (err: any) {
      // `err.code` on an axios error is axios's OWN transport code (e.g.
      // "ERR_BAD_REQUEST"), not the backend's business error code — that
      // lives at err.response.data.code. Using `err.code` first would
      // silently shadow every real backend code with axios's generic one.
      const code = err?.response?.data?.code;
      if (code === "EMAIL_MISMATCH") {
        setView("wrongEmail");
      } else if (code === "INVITE_EXPIRED") {
        setView("expired");
      } else {
        setErrorMsg(toFriendlyErrorMessage(err, "This invitation could not be declined."));
        setView("error");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <Card className="w-full max-w-md border-0 shadow-sm">
        <CardContent className="py-10 text-center space-y-4">
          {view === "loading" && (
            <>
              <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Loading invitation...</p>
            </>
          )}

          {view === "invalid" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Invitation not found</h1>
                <p className="text-sm text-gray-500 mt-1">
                  This invitation link is invalid or has expired. Ask whoever invited you to send a new one.
                </p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}

          {view === "needsAuth" && preview && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  You've been invited to {preview.workspaceName}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Sign in or create an account with the email this invitation was sent to, to accept as{" "}
                  {preview.role}.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => goToAuth("register")} className="flex-1 border-gray-200">
                  Create account
                </Button>
                <Button onClick={() => goToAuth("login")} className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                  <LogIn className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sign in
                </Button>
              </div>
            </>
          )}

          {view === "ready" && preview && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Join {preview.workspaceName} as {preview.role}?
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  You'll be able to switch back to your own workspace at any time.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDecline} className="flex-1 border-gray-200">
                  Decline
                </Button>
                <Button onClick={handleAccept} className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                  Accept
                </Button>
              </div>
            </>
          )}

          {view === "processing" && (
            <>
              <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Processing...</p>
            </>
          )}

          {view === "accepted" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">You're in!</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {preview?.workspaceName ?? "The workspace"} is now your active workspace.
                </p>
              </div>
              <Button asChild className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                <Link to="/dashboard/workspace">Go to Workspace</Link>
              </Button>
            </>
          )}

          {view === "declined" && (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Invitation declined</h1>
                <p className="text-sm text-gray-500 mt-1">You've declined this invitation. Nothing has changed.</p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}

          {view === "expired" && (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">This invitation has expired</h1>
                <p className="text-sm text-gray-500 mt-1">Ask whoever invited you to send a new one.</p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}

          {view === "wrongEmail" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Wrong account</h1>
                <p className="text-sm text-gray-500 mt-1">
                  This invitation was sent to a different email address than the one you're signed in with.
                  Sign out and sign in with the invited address to accept it.
                </p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}

          {view === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {errorMsg || "This invitation could not be processed. Please try again."}
                </p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
