import { CheckCircle2, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InstallDialogDescription,
  InstallDialogShell,
  InstallDialogTitle,
} from "./InstallDialogShell";

interface IosInstallGuideModalProps {
  open: boolean;
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: Share,
    title: "Tap the Share button",
    desc: "Find it in Safari's toolbar — the square with an arrow pointing up.",
  },
  {
    icon: SquarePlus,
    title: 'Tap "Add to Home Screen"',
    desc: "Scroll down the share menu until you see this option.",
  },
  {
    icon: CheckCircle2,
    title: 'Tap "Add" to install',
    desc: "Kolekto will appear on your home screen, ready to open anytime.",
  },
];

const IosInstallGuideModal: React.FC<IosInstallGuideModalProps> = ({
  open,
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
        Add Kolekto to your Home Screen
      </InstallDialogTitle>
      <InstallDialogDescription className="mx-auto mt-1 max-w-[260px] text-sm text-white/80">
        Safari needs a few taps to install — here's how:
      </InstallDialogDescription>
    </div>

    <ol className="space-y-4 px-6 py-5">
      {STEPS.map(({ icon: Icon, title, desc }, i) => (
        <li key={title} className="flex items-start gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-kolekto dark:bg-emerald-500/10 dark:text-emerald-300">
            <Icon className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-kolekto text-[10px] font-bold text-white dark:bg-emerald-500">
              {i + 1}
            </span>
          </span>
          <div className="pt-0.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </p>
            <p className="mt-0.5 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {desc}
            </p>
          </div>
        </li>
      ))}
    </ol>

    <div className="px-6 pb-6">
      <Button
        type="button"
        onClick={onDismiss}
        className="h-12 w-full rounded-xl bg-gradient-to-r from-[#1C5C23] to-[#2E7D32] text-base font-semibold text-white shadow-md hover:opacity-95"
      >
        Got it
      </Button>
    </div>
  </InstallDialogShell>
);

export default IosInstallGuideModal;
