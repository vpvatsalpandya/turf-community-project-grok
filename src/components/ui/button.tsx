import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:brightness-110",
        secondary:
          "bg-raised text-fg shadow-[0_0_0_1px_rgba(232,242,235,0.08)] hover:bg-surface",
        ghost: "text-fg hover:bg-raised",
        danger: "bg-danger text-fg hover:brightness-110",
      },
      size: {
        md: "h-11 min-h-11 px-4",
        sm: "h-9 min-h-9 px-3 text-sm",
        lg: "h-12 min-h-12 px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
