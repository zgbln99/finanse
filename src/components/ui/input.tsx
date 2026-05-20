import * as React from "react";
import { cn } from "@/lib/utils";

// text-input spec: white surface, 1px hairline, 36px, focus -> 2px accent-blue.
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-hairline bg-surface-card px-3 text-[14px] text-ink placeholder:text-ash focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
