"use client";

import { useMemo, useState, type ReactNode } from "react";

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

type WorkbenchPaneProps = {
  children: ReactNode;
  label?: string;
  className?: string;
  contentClassName?: string;
};

type PaneKey = "left" | "main" | "right";

function WorkbenchPane({
  children,
  label,
  className,
  contentClassName,
}: WorkbenchPaneProps) {
  return (
    <section className={cn("rounded-lg border bg-card/70 shadow-sm lg:min-h-0", className)}>
      {label && (
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        </div>
      )}
      <div className={cn("space-y-3 p-3 lg:h-full lg:overflow-y-auto", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export function WorkbenchShell({
  title,
  description,
  actions,
  left,
  main,
  right,
  leftLabel = "Controls",
  mainLabel = "Workspace",
  rightLabel = "Context",
  leftContentClassName,
  mainContentClassName,
  rightContentClassName,
  className,
}: WorkbenchShellProps) {
  const paneTabs = useMemo(
    () =>
      [
        { key: "left" as const, label: leftLabel },
        { key: "main" as const, label: mainLabel },
        ...(right ? [{ key: "right" as const, label: rightLabel }] : []),
      ],
    [leftLabel, mainLabel, right, rightLabel],
  );

  const [mobilePane, setMobilePane] = useState<PaneKey>("main");
  const activeMobilePane =
    paneTabs.some((pane) => pane.key === mobilePane) ? mobilePane : "main";

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

        {paneTabs.length > 1 ? (
          <nav
            className="mb-3 flex gap-1 overflow-x-auto rounded-lg border bg-card/70 p-1 lg:hidden"
            aria-label="Switch workspace pane"
          >
            {paneTabs.map((pane) => {
              const active = pane.key === activeMobilePane;
              return (
                <button
                  key={pane.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMobilePane(pane.key)}
                  className={cn(
                    "min-h-9 flex-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {pane.label}
                </button>
              );
            })}
          </nav>
        ) : null}

        <div
          className={cn(
            "grid gap-3 lg:min-h-0 lg:flex-1",
            right
              ? "lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)_minmax(18rem,24rem)]"
              : "lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)]",
          )}
        >
          <WorkbenchPane
            label={leftLabel}
            contentClassName={leftContentClassName}
            className={cn(activeMobilePane === "left" ? "block" : "hidden lg:block")}
          >
            {left}
          </WorkbenchPane>
          <WorkbenchPane
            label={mainLabel}
            contentClassName={mainContentClassName}
            className={cn(activeMobilePane === "main" ? "block" : "hidden lg:block")}
          >
            {main}
          </WorkbenchPane>
          {right ? (
            <WorkbenchPane
              label={rightLabel}
              contentClassName={rightContentClassName}
              className={cn(activeMobilePane === "right" ? "block" : "hidden lg:block")}
            >
              {right}
            </WorkbenchPane>
          ) : null}
        </div>
      </div>
    </div>
  );
}
