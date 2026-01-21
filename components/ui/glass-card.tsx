import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        className={cn("glass-card-wrap rounded-xl", className)}
        ref={ref}
        {...props}
      >
        <div className="glass-card rounded-xl">
          {children}
        </div>
        <div className="glass-card-shadow rounded-xl"></div>
      </div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
