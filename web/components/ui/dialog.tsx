"use client";
import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { UnderSheet } from "@/components/paper/UnderSheet";
import { CardTape } from "@/components/ui/paper-chrome";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-[var(--scrim)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A card taped onto the page with a second sheet under it. `className` styles the positioned wrapper (width: `sm:max-w-md`);
 * `bodyClassName` styles the card itself (padding, overflow). The close button is a small square paper chit.
 */
function DialogContent({
  className,
  bodyClassName,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean; bodyClassName?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] text-card-foreground outline-none duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        <div className="relative isolate">
          <UnderSheet seed="dialog" dx={5} dy={6} rotate={0.8} />
          <div className={cn("paper-card relative grid max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto p-6 shadow-pop", bodyClassName)}>
            {children}
          </div>
          <CardTape seed="dialog-tape" length={92} height={19} angle={-2.5} align="left" />
          {showCloseButton && (
            <DialogPrimitive.Close className="paper-btn absolute top-3 right-3 z-20 grid size-6 place-items-center rounded-[2px] text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-3.5">
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          )}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({
  className,
  kicker,
  children,
  ...props
}: React.ComponentProps<"div"> & { kicker?: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props}>
      {kicker && <p className="kicker mb-0">{kicker}</p>}
      {children}
    </div>
  );
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-serif text-xl leading-tight font-medium", className)} {...props} />;
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
