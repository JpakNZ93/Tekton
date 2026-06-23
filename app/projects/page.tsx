"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface ProjectMeta {
  id: string;
  site_name: string;
  address: string;
  status: string;
  updated_at: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        if (!response.ok) {
          throw new Error(`Failed to load projects (${response.status})`);
        }
        const data = (await response.json()) as ProjectMeta[];
        if (active) setProjects(data);
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const hasDemoWarehouse = useMemo(
    () => projects.some((project) => project.id === "demo-warehouse"),
    [projects],
  );

  return (
    <main className="h-screen overflow-y-auto bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Scaffold Quoter MVP</p>
            <h1 className="text-3xl font-semibold text-zinc-50">Projects</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/projects/new"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              New project
            </Link>
            {!hasDemoWarehouse ? (
              <Link
                href="/projects/demo-warehouse/ingest"
                className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Open demo-warehouse
              </Link>
            ) : null}
          </div>
        </header>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-2xl shadow-black/30">
          {loading ? (
            <p className="p-6 text-sm text-zinc-400">Loading projects…</p>
          ) : error ? (
            <p className="p-6 text-sm text-red-300">{error}</p>
          ) : projects.length === 0 ? (
            <p className="p-6 text-sm text-zinc-400">No projects yet. Create your first scaffold quote project.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Workspace</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-zinc-800/70 last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-100">{project.site_name}</p>
                      <p className="text-xs text-zinc-500">{project.id}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{project.address || "—"}</td>
                    <td className="px-4 py-3 capitalize text-zinc-300">{project.status}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(project.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/projects/${project.id}/ingest`}
                        className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
