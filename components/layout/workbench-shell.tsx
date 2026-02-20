"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkbenchShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  left: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  leftLabel?: string;
  mainLabel?: string;
  rightLabel?: string;
  leftContentClassName?: string;
  mainContentClassName?: string;
  rightContentClassName?: string;
  className?: string;
};

export function WorkbenchShell({
  title,
  description,
  actions,
  left,
  main,
  right,
  leftLabel: _leftLabel = "Controls",
  mainLabel: _mainLabel = "Workspace",
  rightLabel: _rightLabel = "Context",
  leftContentClassName,
  mainContentClassName,
  rightContentClassName,
  className,
}: WorkbenchShellProps) {
  return (
    <div className={cn("min-h-dvh bg-background", className)}>
      <div className="mx-auto flex min-h-dvh max-w-[1920px] flex-col px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] lg:px-4">
        <header className="mb-3 rounded-lg border bg-card/70 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-balance">{title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
            ) : null}
          </div>
        </header>

        <div
          className={cn(
            "grid gap-3 lg:min-h-0 lg:flex-1",
            right
              ? "lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)_minmax(18rem,24rem)]"
              : "lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]",
          )}
        >
          <div className={cn("space-y-3 lg:min-h-0", leftContentClassName)}>
            {left}
          </div>
          <div className={cn("space-y-3 lg:min-h-0", mainContentClassName)}>
            {main}
          </div>
          {right ? (
            <div className={cn("space-y-3 lg:min-h-0", rightContentClassName)}>
              {right}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
