import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border border-input bg-white px-4 text-sm text-ink transition-colors",
        "placeholder:text-ink-muted/70",
        "focus-visible:border-azure focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure/25",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
