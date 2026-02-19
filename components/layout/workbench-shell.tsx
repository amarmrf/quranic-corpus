import type { ReactNode } from "react";

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

function WorkbenchPane({ children, label, className, contentClassName }: WorkbenchPaneProps) {
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
  return (
    <div className={cn("min-h-dvh bg-background", className)}>
      <div className="mx-auto flex min-h-dvh max-w-[1920px] flex-col px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] lg:px-4">
        <header className="mb-3 rounded-lg border bg-card/70 px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-balance">{title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground text-pretty">{description}</p>
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
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
          <WorkbenchPane label={leftLabel} contentClassName={leftContentClassName}>
            {left}
          </WorkbenchPane>
          <WorkbenchPane label={mainLabel} contentClassName={mainContentClassName}>
            {main}
          </WorkbenchPane>
          {right ? (
            <WorkbenchPane label={rightLabel} contentClassName={rightContentClassName}>
              {right}
            </WorkbenchPane>
          ) : null}
        </div>
      </div>
    </div>
  );
}
