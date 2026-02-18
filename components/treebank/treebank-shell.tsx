"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { normalizeVerseLocation, parseLocation } from "@/lib/location";
import { getSyntax } from "@/lib/api";
import type { SyntaxGraph } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SyntaxGraphRenderer } from "@/components/treebank/syntax-graph-renderer";

type Props = {
  locationParam: string;
  initialGraphNumber: number;
};

export function TreebankShell({ locationParam, initialGraphNumber }: Props) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [graphNumber, setGraphNumber] = useState(initialGraphNumber);
  const [graphData, setGraphData] = useState<SyntaxGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chapterNumber, verseNumber] = useMemo(
    () => normalizeVerseLocation(parseLocation(locationParam)),
    [locationParam],
  );

  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSyntax({
        chapterNumber,
        verseNumber,
        graphNumber,
      });
      setGraphData(response);
      if (response == null) {
        setError("No syntax graph is available for this verse yet.");
      }
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "Unable to load syntax graph.";
      setError(message);
      setGraphData(null);
    } finally {
      setIsLoading(false);
    }
  }, [chapterNumber, verseNumber, graphNumber]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    setGraphNumber(initialGraphNumber);
  }, [initialGraphNumber]);

  const graphOptions = useMemo(() => {
    const count = graphData?.graphCount ?? 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [graphData?.graphCount]);

  const onGraphChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return;
    }
    const maxGraph = graphData?.graphCount ?? 1;
    const nextGraph = Math.min(parsed, maxGraph);
    setGraphNumber(nextGraph);
    router.replace(`/treebank/${chapterNumber}:${verseNumber}?graph=${nextGraph}`);
  };

  const goToGraphLocation = useCallback(
    (target?: { location: [number, number]; graphNumber: number } | null) => {
      if (!target) {
        return;
      }
      const nextPath = `/treebank/${target.location[0]}:${target.location[1]}?graph=${target.graphNumber}`;
      router.push(nextPath);
    },
    [router],
  );

  return (
    <div className="min-h-dvh bg-background pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header
        className="sticky top-0 z-10 border-b bg-background"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="container py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Quranic Corpus Treebank</h1>
              <p className="text-sm text-muted-foreground">
                Treebank route shell for syntax graph rendering and i&apos;rab integration.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => router.push(`/reader/${chapterNumber}:${verseNumber}`)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Reader
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Toggle dark mode"
                onClick={toggleTheme}
              >
                {theme === "dark" ? (
                  <Sun className="size-4" aria-hidden="true" />
                ) : (
                  <Moon className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Verse: {chapterNumber}:{verseNumber}</Badge>
            <Badge variant="outline">API: /syntax</Badge>
            {graphData?.legacyCorpusGraphNumber != null && graphData.legacyCorpusGraphNumber > 0 && (
              <Badge variant="outline">Legacy graph #{graphData.legacyCorpusGraphNumber}</Badge>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="graph-number" className="text-xs text-muted-foreground">
              Graph number
            </label>
            <Input
              id="graph-number"
              type="number"
              min={1}
              max={Math.max(...graphOptions)}
              value={graphNumber}
              onChange={(event) => onGraphChange(event.target.value)}
              className="w-28"
            />
          </div>
        </div>

        {isLoading && (
          <Card className="mt-4">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading syntax graph...
            </CardContent>
          </Card>
        )}

        {error && !isLoading && (
          <Card className="mt-4 border-destructive/40">
            <CardContent className="p-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {graphData && !isLoading && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Graph metadata ({graphData.graphNumber}/{graphData.graphCount})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => goToGraphLocation(graphData.prev)}
                    disabled={!graphData.prev}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Previous graph
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => goToGraphLocation(graphData.next)}
                    disabled={!graphData.next}
                  >
                    Next graph
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <p>
                  Previous:{" "}
                  {graphData.prev ? `${graphData.prev.location.join(":")} (${graphData.prev.graphNumber})` : "-"}
                </p>
                <p>
                  Next: {graphData.next ? `${graphData.next.location.join(":")} (${graphData.next.graphNumber})` : "-"}
                </p>
                <p>Words: {graphData.words.length}</p>
                <p>Edges: {graphData.edges.length}</p>
                <p>Phrase nodes: {graphData.phraseNodes?.length ?? 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Renderer</CardTitle>
              </CardHeader>
              <CardContent>
                <SyntaxGraphRenderer graph={graphData} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Words snapshot</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Arabic</th>
                      <th className="py-2 pr-3">POS</th>
                      <th className="py-2 pr-3">Location</th>
                      <th className="py-2 pr-3">Nodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {graphData.words.map((word, index) => (
                      <tr key={`${word.startNode}-${word.endNode}-${word.type}-${index}`} className="border-b align-top">
                        <td className="py-2 pr-3">{word.type}</td>
                        <td className="py-2 pr-3">
                          {word.token?.segments.map((segment) => segment.arabic ?? "").join("") || word.elidedText || "-"}
                        </td>
                        <td className="py-2 pr-3">{word.elidedPosTag ?? "-"}</td>
                        <td className="py-2 pr-3">
                          {word.token?.location.join(":") ?? "-"}
                        </td>
                        <td className="py-2 pr-3">
                          {word.startNode} {"->"} {word.endNode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
