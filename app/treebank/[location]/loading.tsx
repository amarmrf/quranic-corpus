import { Loader2 } from "lucide-react";

export default function TreebankLoading() {
  return (
    <div className="container flex min-h-dvh items-center justify-center py-10">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading treebank workspace...
      </div>
    </div>
  );
}
