import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        ready: "bg-emerald-100 text-emerald-700",
        pending: "bg-amber-100 text-amber-700",
        error: "bg-red-100 text-red-700",
        outline: "border border-border text-foreground",
        primary: "bg-primary/10 text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
