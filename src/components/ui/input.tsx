import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-raised px-3 text-base text-fg shadow-[0_0_0_1px_rgba(232,242,235,0.08)] outline-none placeholder:text-faint focus-visible:shadow-[0_0_0_1px_var(--color-accent)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md bg-raised px-3 py-2 text-base text-fg shadow-[0_0_0_1px_rgba(232,242,235,0.08)] outline-none placeholder:text-faint focus-visible:shadow-[0_0_0_1px_var(--color-accent)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
