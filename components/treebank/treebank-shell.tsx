"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { normalizeVerseLocation, parseLocation } from "@/lib/location";
import { getSyntax } from "@/lib/api";
import type { SyntaxGraph } from "@/lib/types";
import { WorkbenchShell } from "@/components/layout/workbench-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const maxGraphNumber = Math.max(...graphOptions);

  return (
    <WorkbenchShell
      title="Quranic Corpus Treebank"
      description="Console-style syntax workspace for graph rendering and i'rab inspection."
      leftLabel="Graph Controls"
      mainLabel="Graph Workspace"
      rightLabel="Metadata"
      actions={(
        <>
          <Badge variant="secondary" className="hidden tabular-nums sm:inline-flex">
            API: /syntax
          </Badge>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/reader/${chapterNumber}:${verseNumber}`)}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sm:hidden">Read</span>
            <span className="hidden sm:inline">Reader</span>
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
        </>
      )}
      left={(
        <Card className="bg-card/90">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-balance">Navigation</CardTitle>
            <CardDescription className="text-pretty">
              Control graph number and move between adjacent graphs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                Verse: {chapterNumber}:{verseNumber}
              </Badge>
              {graphData?.legacyCorpusGraphNumber != null && graphData.legacyCorpusGraphNumber > 0 && (
                <Badge variant="outline" className="tabular-nums">
                  Legacy graph #{graphData.legacyCorpusGraphNumber}
                </Badge>
              )}
            </div>

            <div className="space-y-1 rounded-md border p-3">
              <label htmlFor="graph-number" className="text-xs text-muted-foreground">
                Graph number
              </label>
              <Input
                id="graph-number"
                type="number"
                min={1}
                max={maxGraphNumber}
                value={graphNumber}
                onChange={(event) => onGraphChange(event.target.value)}
                className="tabular-nums"
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                Range: 1 to {maxGraphNumber}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToGraphLocation(graphData?.prev)}
                disabled={!graphData?.prev}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous graph
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => goToGraphLocation(graphData?.next)}
                disabled={!graphData?.next}
              >
                Next graph
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Loading syntax graph...
              </div>
            )}

            {error && (
              <div className="space-y-2 rounded-md border border-destructive/40 p-3">
                <p className="text-sm text-destructive text-pretty">{error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void loadGraph()}>
                  Retry graph
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      main={(
        <>
          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="text-base text-balance">Renderer</CardTitle>
              <CardDescription className="text-pretty">
                Syntax graph renderer for verse {chapterNumber}:{verseNumber}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {graphData ? (
                <SyntaxGraphRenderer graph={graphData} />
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-pretty">
                  Graph renderer will appear after data loads.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/90">
            <CardHeader>
              <CardTitle className="text-base text-balance">Words snapshot</CardTitle>
              <CardDescription className="text-pretty">
                Token and node mapping for the currently selected graph.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {graphData ? (
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
                      <tr
                        key={`${word.startNode}-${word.endNode}-${word.type}-${index}`}
                        className="border-b align-top"
                      >
                        <td className="py-2 pr-3">{word.type}</td>
                        <td className="py-2 pr-3">
                          {word.token?.segments.map((segment) => segment.arabic ?? "").join("") || word.elidedText || "-"}
                        </td>
                        <td className="py-2 pr-3">{word.elidedPosTag ?? "-"}</td>
                        <td className="py-2 pr-3 tabular-nums">{word.token?.location.join(":") ?? "-"}</td>
                        <td className="py-2 pr-3 tabular-nums">
                          {word.startNode} {"->"} {word.endNode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground text-pretty">
                  No word rows available until a graph is loaded.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
      right={(
        <>
          <Card className="bg-card/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-balance">Graph metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2 rounded-md border p-2 tabular-nums">
                <span className="text-muted-foreground">Graph</span>
                <span>{graphData ? `${graphData.graphNumber}/${graphData.graphCount}` : "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-2 tabular-nums">
                <span className="text-muted-foreground">Words</span>
                <span>{graphData?.words.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-2 tabular-nums">
                <span className="text-muted-foreground">Edges</span>
                <span>{graphData?.edges.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-2 tabular-nums">
                <span className="text-muted-foreground">Phrase nodes</span>
                <span>{graphData?.phraseNodes?.length ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-balance">Graph neighbors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="rounded-md border p-2 text-pretty tabular-nums">
                Previous:{" "}
                {graphData?.prev
                  ? `${graphData.prev.location.join(":")} (${graphData.prev.graphNumber})`
                  : "-"}
              </p>
              <p className="rounded-md border p-2 text-pretty tabular-nums">
                Next:{" "}
                {graphData?.next
                  ? `${graphData.next.location.join(":")} (${graphData.next.graphNumber})`
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    />
  );
}
