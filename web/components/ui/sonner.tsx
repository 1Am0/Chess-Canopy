"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/*
 * Toasts are sticky notes held on with a strip of tape, with a pencilled word on top (Noted / Note / Caution /
 * Problem, drawn by CSS from the toast type in globals.css `.paper-note`). Errors are a pink note with the pencil in
 * destructive ink. Icons are small inked marks instead of stock glyphs. Sonner keeps the box, stacking and swipe.
 */
const mark = (children: React.ReactNode) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const ICONS = {
  success: mark(<path d="M2.8 8.6L6.2 12.2L13.4 3.6" />),
  info: mark(
    <>
      <path d="M8.2 7.2L7.8 12.6" />
      <path d="M8.1 3.6L8.15 3.7" strokeWidth="2.2" />
    </>,
  ),
  warning: mark(
    <>
      <path d="M8 3L7.9 9.2" />
      <path d="M7.9 12.4L7.95 12.5" strokeWidth="2.2" />
    </>,
  ),
  error: mark(<path d="M3.6 3.4L12.5 12.7M12.4 3.3L3.5 12.6" />),
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={ICONS}
      toastOptions={{ classNames: { toast: "paper-note", title: "text-sm", description: "text-sm" } }}
      {...props}
    />
  );
};

export { Toaster };
