import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg bg-surface-2 px-3 text-base text-fg shadow-[var(--shadow-border)] placeholder:text-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-lg bg-surface-2 px-3 py-2 text-base text-fg shadow-[var(--shadow-border)] placeholder:text-faint",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
