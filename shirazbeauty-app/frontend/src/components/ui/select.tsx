import { ChevronDown } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A styled native <select>. Native is deliberate here: it behaves correctly in
 * RTL, opens the platform picker on mobile, and needs no portal.
 */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-input bg-white ps-4 pe-10 text-sm text-ink transition-colors",
          "focus-visible:border-azure focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute inset-y-0 end-4 my-auto size-4 text-ink-muted" />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
