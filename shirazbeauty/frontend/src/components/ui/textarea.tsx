import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-28 w-full rounded-xl border border-input bg-white p-4 text-sm leading-8 text-ink transition-colors",
      "placeholder:text-ink-muted/70",
        "focus-visible:border-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/25",
      "disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
