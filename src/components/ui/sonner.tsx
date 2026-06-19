
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group kolekto-sonner-toaster"
      closeButton
      duration={3200}
      gap={10}
      visibleToasts={1}
      mobileOffset={16}
      icons={{
        success: <CheckCircle2 className="h-9 w-9" />,
        error: <XCircle className="h-9 w-9" />,
        warning: <AlertTriangle className="h-9 w-9" />,
        info: <Info className="h-9 w-9" />,
        loading: <Loader2 className="h-9 w-9 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast kolekto-sonner-toast group-[.toaster]:border-white/10 group-[.toaster]:bg-slate-950 group-[.toaster]:text-white group-[.toaster]:shadow-2xl",
          title: "group-[.toast]:text-[17px] group-[.toast]:font-semibold group-[.toast]:leading-6 group-[.toast]:tracking-normal",
          description: "group-[.toast]:text-[13px] group-[.toast]:font-medium group-[.toast]:leading-5 group-[.toast]:text-slate-300",
          icon: "group-[.toast]:shrink-0",
          success: "kolekto-sonner-success",
          error: "kolekto-sonner-error",
          warning: "kolekto-sonner-warning",
          info: "kolekto-sonner-info",
          loading: "kolekto-sonner-info",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
