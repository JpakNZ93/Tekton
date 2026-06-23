"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const ScaffoldDesigner = dynamic(
  () => import("../../../../components/scaffold/ScaffoldDesigner"),
  {
    ssr: false,
    loading: () => <p className="text-sm text-zinc-400">Loading scaffold workspace…</p>,
  },
);

export default function ScaffoldPage() {
  const params = useParams<{ id: string }>();
  return <ScaffoldDesigner projectId={params.id} />;
}
