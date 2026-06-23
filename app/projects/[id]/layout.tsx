"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

interface ProjectMeta {
  id: string;
  site_name: string;
  status: string;
  updated_at: string;
}

const TABS = [
  { key: "ingest", label: "Ingest" },
  { key: "building", label: "Building" },
  { key: "scaffold", label: "Scaffold" },
  { key: "quote", label: "Quote" },
];

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const projectId = params.id;
  const [meta, setMeta] = useState<ProjectMeta | null>(null);
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadMeta = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/meta`);
        if (!response.ok) return;
        const data = (await response.json()) as ProjectMeta;
        if (active) setMeta(data);
      } catch {
        // Ignore metadata load issues in workspace shell.
      }
    };
    void loadMeta();
    return () => {
      active = false;
    };
  }, [projectId, runningPipeline]);

  const activeTab = useMemo(
    () => TABS.find((tab) => pathname.includes(`/${tab.key}`))?.key ?? "ingest",
    [pathname],
  );

  const runPipeline = async () => {
    setRunningPipeline(true);
    setPipelineStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/derive`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Pipeline failed");
      }
      setPipelineStatus("Pipeline complete. Building, scaffold, quote, and verifier artifacts refreshed.");
    } catch {
      setPipelineStatus("Pipeline failed. Check ingest and scaffold configuration, then retry.");
    } finally {
      setRunningPipeline(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900/80 p-4">
        <div className="mb-6 space-y-1">
          <Link href="/projects" className="text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-zinc-200">
            ← Projects
          </Link>
          <h2 className="text-lg font-semibold leading-tight text-zinc-50">
            {meta?.site_name ?? "Project workspace"}
          </h2>
          <p className="text-xs text-zinc-400">
            {projectId} · <span className="capitalize">{meta?.status ?? "draft"}</span>
          </p>
        </div>

        <nav className="space-y-2">
          {TABS.map((tab) => {
            const href = `/projects/${projectId}/${tab.key}`;
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                href={href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-emerald-600/20 text-emerald-200"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/90 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400">Scaffold Quoter</p>
            <p className="text-sm text-zinc-300">
              {meta?.site_name ?? projectId} · Updated {meta?.updated_at ? new Date(meta.updated_at).toLocaleString() : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={runPipeline}
            disabled={runningPipeline}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningPipeline ? "Running pipeline…" : "Run Pipeline"}
          </button>
        </header>

        {pipelineStatus ? (
          <p
            className={`px-6 py-2 text-sm ${
              pipelineStatus.startsWith("Pipeline complete") ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {pipelineStatus}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </section>
    </div>
  );
}
