import React, { useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProfileStore } from "@/store/useProfileStore";

const ConfirmEmailChangePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { confirmStep, confirmError, confirmEmailChange } = useProfileStore();

  // Guards against React 18 StrictMode double-invocation in dev — the
  // backend also rejects reuse of an already-consumed token either way.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (token) {
      confirmEmailChange(token);
    }
  }, [token, confirmEmailChange]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-4">
      <Card className="w-full max-w-md border-0 shadow-sm">
        <CardContent className="py-10 text-center space-y-4">
          {!token ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Invalid link</h1>
                <p className="text-sm text-gray-500 mt-1">
                  This confirmation link is missing its token. Please check the link from your email.
                </p>
              </div>
            </>
          ) : confirmStep === "confirming" || confirmStep === "idle" ? (
            <>
              <Loader2 className="w-8 h-8 text-[#1B5E20] animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Confirming your new email...</p>
            </>
          ) : confirmStep === "success" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#1B5E20]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Email updated!</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Your account email has been changed. Use your new email with your existing password next time you sign in.
                </p>
              </div>
              <Button asChild className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white">
                <Link to="/login">Go to Login</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Couldn't confirm email</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {confirmError || "This link may have expired or already been used."}
                </p>
              </div>
              <Button asChild variant="outline" className="border-gray-200">
                <Link to="/dashboard/settings">Back to Profile</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmEmailChangePage;
