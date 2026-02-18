import { Suspense } from "react";

import { SearchShell } from "@/components/search/search-shell";

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchShell />
    </Suspense>
  );
}
