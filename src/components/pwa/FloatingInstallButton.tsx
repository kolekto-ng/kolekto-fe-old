import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstallPlatform } from "@/utils/platformDetection";

interface FloatingInstallButtonProps {
  platform: InstallPlatform;
  onClick: () => void;
}

// Positioned 10px above the WhatsApp floating button
// (fixed bottom-5 right-5, ~62px tall) so the two stack cleanly on every
// screen size without ever overlapping horizontally.
const FloatingInstallButton: React.FC<FloatingInstallButtonProps> = ({
  platform,
  onClick,
}) => {
  const label =
    platform === "ios" ? "Show install instructions" : "Install Kolekto App";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-[92px] right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-gradient-to-br from-[#1C5C23] to-[#2E7D32] text-white shadow-lg shadow-green-900/30",
        "transition-transform duration-200 hover:scale-105 active:scale-95",
        "animate-in fade-in-0 zoom-in-90 duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
      )}
    >
      <Download className="h-5 w-5" />
    </button>
  );
};

export default FloatingInstallButton;
