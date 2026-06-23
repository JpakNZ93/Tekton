"use client";

import { useParams } from "next/navigation";
import IngestForm from "../../../../components/scaffold/IngestForm";

export default function IngestPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Ingest</p>
        <h1 className="text-2xl font-semibold text-zinc-50">Building canonical input</h1>
        <p className="text-sm text-zinc-400">
          Enter footprint and face heights with provenance labels, then run the pipeline.
        </p>
      </header>
      <IngestForm projectId={params.id} />
    </div>
  );
}
