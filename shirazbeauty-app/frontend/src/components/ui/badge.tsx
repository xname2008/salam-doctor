import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-surface text-ink-muted",
        azure: "bg-azure-tint text-azure-dark",
        outline: "border border-azure/35 text-azure-dark",
        verified: "bg-mint/12 text-mint",
        warning: "bg-amber/15 text-amber",
        danger: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
