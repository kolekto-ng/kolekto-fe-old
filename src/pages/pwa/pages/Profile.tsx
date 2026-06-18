import React from "react";
import { useNavigate } from "react-router-dom";
import PersonalInfoTab from "@/components/profile/PersonalInfoTab";
import KYCVerificationTab from "@/components/profile/KYCVerificationTab";
import LoginSecuritySection from "@/components/profile/LoginSecuritySection";
import BankDetailsSection from "@/components/profile/BankDetailsSection";
import { useAuthStore } from "@/store/useAuthStore";
import { useProfileStore } from "@/store/useProfileStore";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ArrowLeft,
    Building2,
    ChevronRight,
    Lock,
    LogOut,
    Shield,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";

const profileSections = [
    {
        id: "security",
        label: "Login & Security",
        description: "Password, access, and account protection",
        icon: Lock,
    },
    {
        id: "kyc",
        label: "KYC Verification",
        description: "Identity verification and compliance status",
        icon: Shield,
    },
    {
        id: "bank",
        label: "Bank Details",
        description: "Withdrawal bank account information",
        icon: Building2,
    },
];

const PwaProfile: React.FC = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = React.useState("personal");
    const { user, signOut } = useAuthStore() as any;
    const { kycData, fetchKYCStatus } = useProfileStore();

    React.useEffect(() => {
        if (user?.id) {
            fetchKYCStatus(user.id);
        }
    }, [user?.id, fetchKYCStatus]);

    const kycStatus = kycData?.overallStatus || user?.verification_status || "not_started";
    const kycComplete = kycStatus === "verified";
    const currentSection = profileSections.find((section) => section.id === activeSection);
    const displayName = user?.user_metadata?.full_name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email;

    const handleSignOut = async () => {
        await signOut?.();
        navigate("/login", { replace: true });
    };

    const renderSection = () => {
        switch (activeSection) {
            case "security":
                return <LoginSecuritySection />;
            case "kyc":
                return <KYCVerificationTab />;
            case "bank":
                return <BankDetailsSection />;
            default:
                return <PersonalInfoTab kycStatus={kycStatus} />;
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-5 pb-6">
            {activeSection === "personal" ? (
                <>
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex min-w-0 items-center gap-4">
                            <div className="relative shrink-0">
                                <Avatar className="h-16 w-16 ring-4 ring-emerald-50">
                                    {user?.avatar_url ? (
                                        <AvatarImage src={user.avatar_url} alt={user?.email || "User"} />
                                    ) : (
                                        <AvatarFallback>{(user?.first_name || user?.email || "U").charAt(0)}</AvatarFallback>
                                    )}
                                </Avatar>
                                <span
                                    className={`absolute -right-1 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg ${
                                        kycComplete
                                            ? "bg-emerald-500 text-white shadow-emerald-200"
                                            : "bg-amber-100 text-amber-700 shadow-amber-100"
                                    }`}
                                    aria-label={kycComplete ? "Verified account" : "Verification pending"}
                                >
                                    {kycComplete ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                                </span>
                            </div>
                            <div className="min-w-0">
                                <h2 className="break-words text-xl font-bold leading-tight text-gray-900">
                                    {displayName}
                                </h2>
                                <p className="mt-1 break-all text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                        </div>
                    </div>

                    <PersonalInfoTab kycStatus={kycStatus} />

                    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                        <div className="space-y-2">
                            {profileSections.map((section) => {
                                const Icon = section.icon;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => setActiveSection(section.id)}
                                        className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-gray-50 active:scale-[0.99]"
                                    >
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-gray-900">{section.label}</span>
                                            <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{section.description}</span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <Button variant="destructive" className="min-h-11 w-full justify-center" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                    </Button>
                </>
            ) : (
                <div className="space-y-5">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setActiveSection("personal")}
                            aria-label="Back to profile"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.96]"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h1 className="min-w-0 text-xl font-bold leading-tight text-gray-900">
                            {currentSection?.label}
                        </h1>
                    </div>

                    <div className="transition-opacity duration-200">{renderSection()}</div>
                </div>
            )}
        </div>
    );
};

export default PwaProfile;
