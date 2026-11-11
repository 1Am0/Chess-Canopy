"use client";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/*
 * Field-note slip: paper card, perforated top edge, hairline frame, a kicker line drawn by CSS
 * (Noted / Note / Caution / Problem) above the message. Errors print in destructive ink, never a red fill.
 * Sonner sets `background` as a shorthand, so the perforation needs `!`.
 */
// Class names are written out in full so Tailwind's scanner sees them.
const KICKER =
  "[&_[data-content]]:before:mb-0.5 [&_[data-content]]:before:block [&_[data-content]]:before:kicker";
const WORDS = {
  success: `${KICKER} [&_[data-content]]:before:content-['Noted']`,
  info: `${KICKER} [&_[data-content]]:before:content-['Note']`,
  warning: `${KICKER} [&_[data-content]]:before:content-['Caution']`,
  error: `${KICKER} [&_[data-content]]:before:content-['Problem']`,
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--rule-strong)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "perforated! rounded-md! border! border-rule-strong! pt-5! shadow-paper! font-sans",
          title: "text-sm font-medium",
          description: "text-muted-foreground!",
          icon: "text-primary",
          success: WORDS.success,
          info: WORDS.info,
          warning: WORDS.warning,
          error: `${WORDS.error} border-loss! text-loss-text! [&_[data-icon]]:text-loss-text [&_[data-content]]:before:text-loss-text`,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
