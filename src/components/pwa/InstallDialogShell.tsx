import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstallDialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export const InstallDialogTitle = DialogPrimitive.Title;
export const InstallDialogDescription = DialogPrimitive.Description;

// A bespoke, lightweight Radix dialog shell (rather than the shared
// `ui/dialog.tsx`) so the close affordance can sit on top of these modals'
// branded gradient header with proper contrast, without changing the close
// button styling used by every other dialog in the app.
export const InstallDialogShell: React.FC<InstallDialogShellProps> = ({
  open,
  onOpenChange,
  children,
  className,
}) => (
  <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        )}
      />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-3xl bg-white shadow-2xl outline-none dark:bg-slate-900",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:slide-in-from-bottom-2",
          "duration-200",
          className
        )}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className={cn(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full",
            "bg-white/20 text-white outline-none transition hover:bg-white/30",
            "focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0"
          )}
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
);
