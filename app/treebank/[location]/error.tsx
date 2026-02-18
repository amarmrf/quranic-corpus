"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function TreebankError({ error, reset }: Props) {
  return (
    <div className="container flex min-h-dvh items-center justify-center py-10">
      <div className="max-w-xl space-y-3 rounded-lg border border-destructive/40 bg-card p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Treebank route error</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {error.message || "An unexpected treebank error occurred."}
        </p>
        <Button type="button" variant="outline" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
