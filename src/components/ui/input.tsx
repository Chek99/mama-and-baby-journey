import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border-2 border-input bg-card px-4 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-role focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
