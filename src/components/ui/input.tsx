import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
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

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md bg-raised px-3 text-base text-fg shadow-[0_0_0_1px_rgba(232,242,235,0.08)] outline-none focus-visible:shadow-[0_0_0_1px_var(--color-accent)] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        {required ? <span className="text-accent"> · needed</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs leading-snug text-faint">{hint}</span> : null}
    </label>
  );
}
