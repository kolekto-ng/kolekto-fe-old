// Compatibility shim. The app now has ONE toast system (Sonner). This used to
// be a standalone Radix toast store with its own <Toaster /> — that second
// stack is gone. Existing callers that still do `const { toast } = useToast()`
// and `toast({ title, description, variant })` keep working, but every toast
// is now rendered by Sonner through the shared, deduped helper in lib/toast.
import * as React from "react";
import { toast as sonnerToast } from "@/lib/toast";

type RadixToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | null;
  // Accepted for source compatibility; ignored by Sonner.
  action?: React.ReactNode;
  duration?: number;
};

function toMessage(node: React.ReactNode): string {
  return typeof node === "string" ? node : node == null ? "" : String(node);
}

export function toast({ title, description, variant, duration }: RadixToastInput) {
  const message = toMessage(title) || toMessage(description);
  const opts =
    title && description ? { description: toMessage(description), duration } : { duration };

  const id =
    variant === "destructive"
      ? sonnerToast.error(message, opts)
      : sonnerToast.success(message, opts);

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: () => undefined,
  };
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
    // Nothing renders this list anymore (Sonner owns rendering); kept so older
    // destructuring `const { toasts } = useToast()` never crashes.
    toasts: [] as never[],
  };
}

export { toast as sonnerToast };
