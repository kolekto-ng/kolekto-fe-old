import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { useCollectionAccessStore } from "@/store/useCollectionAccessStore";

type ViewState = "loading" | "offer" | "responding" | "accepted" | "declined" | "error";

const CollectionAccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { user, isLoading: authLoading } = useAuthStore() as any;
  const { respondToAccess } = useCollectionAccessStore() as any;

  const [view, setView] = useState<ViewState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setView("error");
      setErrorMsg("This link is missing its token. Please check the link from your email.");
      return;
    }
    if (!user) {
      // Not logged in — redirect through login. The login page already offers
      // a "Register" link that carries the redirect param forward, so a
      // brand-new invited email can sign up and land right back here.
      const redirect = `/collection-access?token=${encodeURIComponent(token)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }
    setView("offer");
  }, [authLoading, user, token, navigate]);

  const respond = async (action: "accept" | "decline") => {
    if (!token) return;
    setView("responding");
    const result = await respondToAccess(token, action);
    if (result.success) {
      setView(action === "accept" ? "accepted" : "declined");
    } else {
      setErrorMsg(result.error);
      setView("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <Card className="w-full max-w-md border-0 shadow-sm">
        <CardContent className="py-10 text-center space-y-4">
          {view === "loading" && (
            <>
              <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Loading...</p>
            </>
          )}

          {view === "offer" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <Users className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Collection access invite</h1>
                <p className="text-sm text-gray-500 mt-1">
                  You've been given limited, read-only access to a Kolekto collection. This does not transfer ownership.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => respond("decline")}
                  className="flex-1 border-gray-200"
                >
                  Decline
                </Button>
                <Button
                  onClick={() => respond("accept")}
                  className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
                >
                  Accept
                </Button>
              </div>
            </>
          )}

          {view === "responding" && (
            <>
              <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Processing your response...</p>
            </>
          )}

          {view === "accepted" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Access granted!</h1>
                <p className="text-sm text-gray-500 mt-1">
                  You can now view the shared collection(s) under "Shared with Me".
                </p>
              </div>
              <Button asChild className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                <Link to="/dashboard/shared-with-me">View Shared Collections</Link>
              </Button>
            </>
          )}

          {view === "declined" && (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Invite declined</h1>
                <p className="text-sm text-gray-500 mt-1">
                  You've declined this invite. Nothing has changed.
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
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Couldn't process this invite</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {errorMsg || "This link may have expired or already been used."}
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
};

export default CollectionAccessPage;
