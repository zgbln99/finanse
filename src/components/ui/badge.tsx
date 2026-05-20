import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-soft text-charcoal",
        blue: "bg-accent-blue-soft text-link-blue",
        green: "bg-accent-green-soft text-accent-green",
        red: "bg-accent-red-soft text-accent-red",
        purple: "bg-accent-purple-soft text-accent-purple",
        outline: "border border-hairline text-body",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Colored dot + label chip used for semantic tags (uses the tag's own color). */
export function TagChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-semibold"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
