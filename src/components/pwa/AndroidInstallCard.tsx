import { Download, ShieldCheck, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InstallDialogDescription,
  InstallDialogShell,
  InstallDialogTitle,
} from "./InstallDialogShell";

interface AndroidInstallCardProps {
  open: boolean;
  isInstalling: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

const PERKS = [
  { icon: Zap, label: "Instant access from your home screen" },
  { icon: WifiOff, label: "Keeps working on a weak connection" },
  { icon: ShieldCheck, label: "Same secure Kolekto — no app store needed" },
];

const AndroidInstallCard: React.FC<AndroidInstallCardProps> = ({
  open,
  isInstalling,
  onInstall,
  onDismiss,
}) => (
  <InstallDialogShell
    open={open}
    onOpenChange={(next) => {
      if (!next) onDismiss();
    }}
  >
    <div className="bg-gradient-to-br from-[#1B5E20] via-[#1C5C23] to-[#2E7D32] px-6 pb-6 pt-9 text-center text-white">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 p-2 shadow-inner">
        <img
          src="/kelekto_logo-removebg-preview.png"
          alt=""
          className="h-full w-full object-contain"
        />
      </div>
      <InstallDialogTitle className="text-xl font-bold text-white">
        Install Kolekto App
      </InstallDialogTitle>
      <InstallDialogDescription className="mx-auto mt-1 max-w-[260px] text-sm text-white/80">
        Add Kolekto to your home screen for instant, app-like access.
      </InstallDialogDescription>
    </div>

    <div className="space-y-3 px-6 py-5">
      {PERKS.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto dark:bg-emerald-500/10 dark:text-emerald-300">
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </div>
      ))}
    </div>

    <div className="flex flex-col gap-2 px-6 pb-6">
      <Button
        type="button"
        onClick={onInstall}
        disabled={isInstalling}
        className="h-12 rounded-xl bg-gradient-to-r from-[#1C5C23] to-[#2E7D32] text-base font-semibold text-white shadow-md hover:opacity-95"
      >
        <Download className="mr-2 h-5 w-5" />
        {isInstalling ? "Installing..." : "Install Kolekto App"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onDismiss}
        className="h-11 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        Maybe later
      </Button>
    </div>
  </InstallDialogShell>
);

export default AndroidInstallCard;
