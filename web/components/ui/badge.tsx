import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em]",
  {
    variants: {
      variant: {
        default: "border-accent/30 bg-accent-soft text-monad-700",
        outline: "border-border bg-bg-elev text-ink-dim",
        good: "border-allow/25 bg-[rgba(31,122,61,0.08)] text-allow",
        bad: "border-deny/25 bg-[rgba(193,59,38,0.08)] text-deny",
        warn: "border-warn/25 bg-[rgba(176,125,18,0.1)] text-warn",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
