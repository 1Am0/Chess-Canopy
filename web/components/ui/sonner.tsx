"use client";
import { useSyncExternalStore } from "react";
import { useExplorerStore } from "@/lib/store";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XCircleIcon } from "lucide-react";

const ICONS = {
  success: <CheckCircle2Icon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <AlertTriangleIcon className="size-4" />,
  error: <XCircleIcon className="size-4" />,
};

const PHONE = "(max-width: 639.98px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

const Toaster = ({ ...props }: ToasterProps) => {
  const phone = useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);
  const sheetOpen = useExplorerStore((s) => s.filtersOpen || s.importOpen || s.managerOpen);
  // Phones: top-center, just under the 56px header. Desktop: bottom-right, moving to the top while a sheet/dialog
  // is open so toasts never cover its footer buttons.
  const position = phone ? "top-center" : sheetOpen ? "top-right" : "bottom-right";
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={ICONS}
      position={position}
      duration={4000}
      offset={{ top: 68, right: 16, bottom: 16, left: 16 }}
      mobileOffset={{ top: 64, left: 12, right: 12 }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "var(--border)",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--border)",
          "--info-bg": "var(--popover)",
          "--info-text": "var(--popover-foreground)",
          "--info-border": "var(--border)",
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "shadow-pop", title: "text-sm", description: "text-sm" } }}
      {...props}
    />
  );
};

export { Toaster };
