
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
      duration={4000}
      gap={12}
      visibleToasts={3}
      offset={16}
      mobileOffset={12}
      icons={{
        success: <CheckCircle2 className="h-5 w-5" />,
        error: <XCircle className="h-5 w-5" />,
        warning: <AlertTriangle className="h-5 w-5" />,
        info: <Info className="h-5 w-5" />,
        loading: <Loader2 className="h-5 w-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "group toast kolekto-sonner-toast",
          title: "kolekto-sonner-title",
          description: "kolekto-sonner-description",
          icon: "kolekto-sonner-icon",
          closeButton: "kolekto-sonner-close",
          success: "kolekto-sonner-success",
          error: "kolekto-sonner-error",
          warning: "kolekto-sonner-warning",
          info: "kolekto-sonner-info",
          loading: "kolekto-sonner-loading",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
export { toast } from "sonner"
