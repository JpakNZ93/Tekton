"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const BuildingViewer = dynamic(
  () => import("../../../../components/scaffold/BuildingViewer"),
  {
    ssr: false,
    loading: () => <p className="text-sm text-zinc-400">Loading building viewer…</p>,
  },
);

export default function BuildingPage() {
  const params = useParams<{ id: string }>();
  return <BuildingViewer projectId={params.id} />;
}
