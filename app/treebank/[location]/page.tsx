import { TreebankShell } from "@/components/treebank/treebank-shell";

type PageProps = {
  params: Promise<{ location: string }>;
  searchParams: Promise<{ graph?: string }>;
};

export default async function TreebankPage({ params, searchParams }: PageProps) {
  const { location } = await params;
  const { graph } = await searchParams;

  const parsedGraph = Number.parseInt(graph ?? "1", 10);
  const initialGraphNumber = Number.isFinite(parsedGraph) && parsedGraph >= 1 ? parsedGraph : 1;

  return <TreebankShell locationParam={location} initialGraphNumber={initialGraphNumber} />;
}
