import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[transform,background-color,opacity,box-shadow] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg select-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-2 shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]",
        secondary:
          "bg-surface-2 text-fg shadow-[var(--shadow-border)] hover:bg-surface-3",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        danger: "bg-danger text-fg hover:opacity-90",
        outline: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:bg-surface-2",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-md",
        md: "h-11 px-4 text-sm rounded-lg",
        lg: "h-12 px-5 text-base rounded-xl",
        icon: "size-11 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";

export { buttonVariants };
