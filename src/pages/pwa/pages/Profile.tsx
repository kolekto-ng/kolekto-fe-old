import React from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalInfoTab from "@/components/profile/PersonalInfoTab";
import KYCVerificationTab from "@/components/profile/KYCVerificationTab";
import { useAuthStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const PwaProfile: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuthStore() as any;

    const kycStatus = user?.verification_status || "not_started";
    const kycComplete = kycStatus === "verified";

    const handleSignOut = async () => {
        await signOut?.();
        navigate("/login", { replace: true });
    };

    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        {user?.avatar_url ? (
                            <AvatarImage src={user.avatar_url} alt={user?.email || "User"} />
                        ) : (
                            <AvatarFallback>{(user?.first_name || user?.email || "U").charAt(0)}</AvatarFallback>
                        )}
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-semibold">
                            {user?.user_metadata?.full_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email}
                        </h2>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <div className="mt-1">
                            <Badge variant={kycComplete ? "secondary" : "outline"}>
                                {kycComplete ? "KYC Verified" : "KYC Incomplete"}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={() => navigate("/profile/settings")}>
                        Settings
                    </Button>
                    <Button variant="destructive" onClick={handleSignOut}>
                        Sign out
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="personal" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="personal">Personal Info</TabsTrigger>
                    {!kycComplete && <TabsTrigger value="kyc">KYC Verification</TabsTrigger>}
                </TabsList>

                <TabsContent value="personal">
                    <PersonalInfoTab kycStatus={kycStatus} />
                </TabsContent>

                {!kycComplete && (
                    <TabsContent value="kyc">
                        <KYCVerificationTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default PwaProfile;