"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import { clearSession } from "@/lib/auth";

interface SignOutButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  onSignOut?: () => void;
}

/**
 * Drops the stored tokens before leaving the dashboard. Forwards its ref and
 * props so it can be dropped into a Radix `asChild` slot.
 */
export const SignOutButton = React.forwardRef<HTMLButtonElement, SignOutButtonProps>(
  ({ onSignOut, onClick, ...props }, ref) => {
    const router = useRouter();

    return (
      <button
        ref={ref}
        type="button"
        {...props}
        onClick={(event) => {
          onClick?.(event);
          clearSession();
          onSignOut?.();
          router.replace("/auth/login");
          // Discards any cached authenticated payloads held by the router.
          router.refresh();
        }}
      />
    );
  },
);
SignOutButton.displayName = "SignOutButton";
