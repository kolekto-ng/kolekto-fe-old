
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, XCircle } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isError = props.variant === "destructive"
        const Icon = isError ? XCircle : CheckCircle2
        return (
          <Toast key={id} {...props}>
            <span
              className={`relative z-10 flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full border shadow-2xl ${
                isError
                  ? "border-red-300/30 bg-gradient-to-br from-red-400 to-red-600 text-white shadow-red-500/35"
                  : "border-emerald-300/30 bg-gradient-to-br from-emerald-400 to-kolekto text-white shadow-emerald-500/35"
              }`}
            >
              <Icon className="h-9 w-9" />
            </span>
            <div className="relative z-10 grid min-w-0 gap-2 text-center">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action && <div className="relative z-10 mt-1">{action}</div>}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
