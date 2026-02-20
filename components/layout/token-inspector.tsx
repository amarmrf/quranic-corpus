"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TokenInspectorProps = {
  title: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  containerClassName?: string;
  cardClassName?: string;
  contentClassName?: string;
};

export function TokenInspector({
  title,
  description,
  headerActions,
  children,
  containerClassName,
  cardClassName,
  contentClassName,
}: TokenInspectorProps) {
  return (
    <div className={cn("lg:sticky lg:top-0", containerClassName)}>
      <Card
        className={cn(
          "bg-card/90 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:overflow-hidden",
          cardClassName,
        )}
      >
        <CardHeader className={cn(headerActions && "space-y-3")}>
          <CardTitle className="text-base text-balance">{title}</CardTitle>
          {description && <CardDescription className="text-pretty">{description}</CardDescription>}
          {headerActions}
        </CardHeader>
        <CardContent
          className={cn("space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto", contentClassName)}
        >
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
