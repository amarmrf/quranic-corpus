import type { SyntaxGraph } from "@/lib/types";

type Props = {
  graph: SyntaxGraph;
};

type PhraseLane = {
  start: number;
  end: number;
};

function getNodeCount(graph: SyntaxGraph) {
  const wordMax = graph.words.reduce((max, word) => Math.max(max, word.endNode), 0);
  const edgeMax = graph.edges.reduce(
    (max, edge) => Math.max(max, edge.startNode, edge.endNode),
    0,
  );
  const phraseMax =
    graph.phraseNodes?.reduce(
      (max, phraseNode) => Math.max(max, phraseNode.startNode, phraseNode.endNode),
      0,
    ) ?? 0;
  return Math.max(1, wordMax, edgeMax, phraseMax);
}

function getWordArabic(graph: SyntaxGraph["words"][number]) {
  if (graph.token != null) {
    return graph.token.segments.map((segment) => segment.arabic ?? "").join("").trim() || "—";
  }
  return graph.elidedText ?? "(*)";
}

function getPhraseLevels(graph: SyntaxGraph) {
  const phrases = graph.phraseNodes ?? [];
  const lanes: PhraseLane[][] = [];

  return phrases.map((phrase) => {
    const start = Math.min(phrase.startNode, phrase.endNode);
    const end = Math.max(phrase.startNode, phrase.endNode);

    let level = 0;
    for (; level < lanes.length; level++) {
      const lane = lanes[level];
      const overlaps = lane.some((item) => !(end < item.start || start > item.end));
      if (!overlaps) {
        break;
      }
    }

    if (lanes[level] == null) {
      lanes[level] = [];
    }
    lanes[level].push({ start, end });
    return level;
  });
}

export function SyntaxGraphRenderer({ graph }: Props) {
  const nodeCount = getNodeCount(graph);
  const nodeGap = 96;
  const leftPadding = 48;
  const rightPadding = 48;

  const width = leftPadding + rightPadding + (nodeCount - 1) * nodeGap;
  const nodesY = 300;
  const wordsY = 238;
  const phraseBaseY = 330;
  const phraseLevelGap = 28;

  const phraseLevels = getPhraseLevels(graph);
  const maxPhraseLevel = phraseLevels.length > 0 ? Math.max(...phraseLevels) : -1;
  const phraseHeight = Math.max(0, (maxPhraseLevel + 1) * phraseLevelGap);
  const height = phraseBaseY + phraseHeight + 88;

  const nodeX = (node: number) => leftPadding + (Math.max(1, node) - 1) * nodeGap;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-full"
        role="img"
        aria-label="Syntax graph"
      >
        {graph.edges.map((edge, index) => {
          const from = nodeX(edge.startNode);
          const to = nodeX(edge.endNode);
          const left = Math.min(from, to);
          const right = Math.max(from, to);
          const distance = Math.max(1, right - left);
          const arcHeight = Math.max(56, Math.min(220, distance * 0.52));
          const topY = nodesY - arcHeight;
          const controlX = (from + to) / 2;
          const controlY = topY - 12;
          const endX = to;
          const endY = nodesY;
          const arrowLeft = from > to;
          const labelY = topY - 6;

          return (
            <g key={`edge-${index}`}>
              <path
                d={`M ${from} ${nodesY} Q ${controlX} ${controlY} ${to} ${nodesY}`}
                fill="none"
                stroke="hsl(var(--muted-foreground) / 0.9)"
                strokeWidth={1.8}
              />
              <polygon
                points={
                  arrowLeft
                    ? `${endX},${endY} ${endX + 9},${endY - 3.5} ${endX + 9},${endY + 3.5}`
                    : `${endX},${endY} ${endX - 9},${endY - 3.5} ${endX - 9},${endY + 3.5}`
                }
                fill="hsl(var(--muted-foreground) / 0.9)"
              />
              <rect
                x={controlX - Math.max(26, edge.dependencyTag.length * 3.6)}
                y={labelY - 15}
                rx={6}
                width={Math.max(52, edge.dependencyTag.length * 7.2)}
                height={20}
                fill="hsl(var(--background) / 0.9)"
                stroke="hsl(var(--border))"
              />
              <text
                x={controlX}
                y={labelY - 1}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px] font-medium"
              >
                {edge.dependencyTag}
              </text>
            </g>
          );
        })}

        {(graph.phraseNodes ?? []).map((phraseNode, index) => {
          const start = nodeX(phraseNode.startNode);
          const end = nodeX(phraseNode.endNode);
          const level = phraseLevels[index] ?? 0;
          const y = phraseBaseY + level * phraseLevelGap;
          const left = Math.min(start, end);
          const right = Math.max(start, end);
          const mid = (left + right) / 2;

          return (
            <g key={`phrase-${index}`}>
              <line x1={left} y1={y} x2={right} y2={y} stroke="hsl(var(--primary) / 0.55)" strokeWidth={2} />
              <circle cx={left} cy={y} r={4} fill="hsl(var(--primary) / 0.75)" />
              <circle cx={right} cy={y} r={4} fill="hsl(var(--primary) / 0.75)" />
              <text x={mid} y={y - 8} textAnchor="middle" className="fill-primary text-[11px] font-semibold">
                {phraseNode.phraseTag}
              </text>
            </g>
          );
        })}

        {Array.from({ length: nodeCount }, (_, index) => index + 1).map((node) => {
          const x = nodeX(node);
          return (
            <g key={`node-${node}`}>
              <line
                x1={x}
                y1={nodesY - 10}
                x2={x}
                y2={nodesY + 10}
                stroke="hsl(var(--border))"
                strokeWidth={1.5}
              />
              <circle cx={x} cy={nodesY} r={11} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
              <text x={x} y={nodesY + 4} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
                {node}
              </text>
            </g>
          );
        })}

        {graph.words.map((word, index) => {
          const start = nodeX(word.startNode);
          const end = nodeX(word.endNode);
          const center = (start + end) / 2;
          const arabic = getWordArabic(word);
          const isElided = word.type === "elided";
          const location = word.token?.location.join(":") ?? "";
          const posTag = word.elidedPosTag ?? "";

          return (
            <g key={`word-${index}`}>
              {location.length > 0 && (
                <text x={center} y={wordsY - 34} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {location}
                </text>
              )}
              <text
                x={center}
                y={wordsY}
                textAnchor="middle"
                direction="rtl"
                className={isElided ? "fill-muted-foreground text-[20px]" : "fill-foreground text-[24px]"}
              >
                {arabic}
              </text>
              {posTag.length > 0 && (
                <text x={center} y={wordsY + 20} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {posTag}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
