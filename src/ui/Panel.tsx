import React, { ComponentPropsWithoutRef, forwardRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@boredkevin/ui";

export interface PanelProps extends ComponentPropsWithoutRef<typeof Card> {
  children?: React.ReactNode;
  className?: string;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className = "", ...props }, ref) => {
    return (
      <Card
        ref={ref}
        cornerLines={false}
        liquidGlass={false}
        telemetry={undefined}
        className={`fintech-panel border border-border/80 bg-card/90 text-card-foreground shadow-sm ${className}`}
        {...props}
      >
        {children}
      </Card>
    );
  }
);
Panel.displayName = "Panel";

export const PanelHeader = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof CardHeader>>(
  ({ className = "", ...props }, ref) => (
    <CardHeader ref={ref} className={`p-4 sm:p-5 ${className}`} {...props} />
  )
);
PanelHeader.displayName = "PanelHeader";

export const PanelTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof CardTitle>>(
  ({ className = "", ...props }, ref) => (
    <CardTitle ref={ref} className={`text-base font-semibold tracking-tight text-foreground ${className}`} {...props} />
  )
);
PanelTitle.displayName = "PanelTitle";

export const PanelDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<typeof CardDescription>>(
  ({ className = "", ...props }, ref) => (
    <CardDescription ref={ref} className={`text-xs text-muted-foreground ${className}`} {...props} />
  )
);
PanelDescription.displayName = "PanelDescription";

export const PanelContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof CardContent>>(
  ({ className = "", ...props }, ref) => (
    <CardContent ref={ref} className={`p-4 sm:p-5 pt-0 ${className}`} {...props} />
  )
);
PanelContent.displayName = "PanelContent";

export const PanelFooter = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof CardFooter>>(
  ({ className = "", ...props }, ref) => (
    <CardFooter ref={ref} className={`p-4 sm:p-5 pt-0 border-t border-border/50 ${className}`} {...props} />
  )
);
PanelFooter.displayName = "PanelFooter";
