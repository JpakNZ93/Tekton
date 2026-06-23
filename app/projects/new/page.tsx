"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [siteName, setSiteName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: siteName.trim(),
          address: address.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create project (${response.status})`);
      }
      const data = (await response.json()) as { id: string };
      router.push(`/projects/${data.id}/ingest`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <main className="h-screen overflow-y-auto bg-zinc-950 p-8 text-zinc-100">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Scaffold Quoter MVP</p>
          <h1 className="text-3xl font-semibold text-zinc-50">Create project</h1>
          <p className="text-sm text-zinc-400">
            Start a new scaffold estimate workspace. You can refine dimensions and face data in the Ingest tab.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Site name</span>
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              required
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
              placeholder="Demo Warehouse"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-zinc-300">Address</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
              placeholder="Unit 4, Industrial Estate"
            />
          </label>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !siteName.trim()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create project"}
            </button>
            <Link href="/projects" className="text-sm text-zinc-400 hover:text-zinc-200">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
