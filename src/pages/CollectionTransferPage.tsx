import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { useCollectionStore } from "@/store/useCollectionStore";

type ViewState = "loading" | "offer" | "responding" | "accepted" | "declined" | "error";

const CollectionTransferPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { user, isLoading: authLoading } = useAuthStore() as any;
  const { respondToCollectionTransfer } = useCollectionStore() as any;

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
      const redirect = `/collection-transfer?token=${encodeURIComponent(token)}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }
    setView("offer");
  }, [authLoading, user, token, navigate]);

  const respond = async (action: "accept" | "decline") => {
    if (!token) return;
    setView("responding");
    const result = await respondToCollectionTransfer(token, action);
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
                <ArrowLeftRight className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Collection transfer offer</h1>
                <p className="text-sm text-gray-500 mt-1">
                  You've been offered ownership of a Kolekto collection. Accepting moves it (including its balance) into your account.
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
                <h1 className="text-lg font-semibold text-gray-900">Transfer accepted!</h1>
                <p className="text-sm text-gray-500 mt-1">
                  The collection now appears in your dashboard.
                </p>
              </div>
              <Button asChild className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                <Link to="/dashboard/collections">Go to Collections</Link>
              </Button>
            </>
          )}

          {view === "declined" && (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Transfer declined</h1>
                <p className="text-sm text-gray-500 mt-1">
                  You've declined this transfer. Nothing has changed.
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
                <h1 className="text-lg font-semibold text-gray-900">Couldn't process this transfer</h1>
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

export default CollectionTransferPage;
