import { ReaderShell } from "@/components/reader/reader-shell";

type PageProps = {
  params: Promise<{ location: string }>;
};

export default async function ReaderPage({ params }: PageProps) {
  const { location } = await params;
  return <ReaderShell locationParam={location} />;
}
