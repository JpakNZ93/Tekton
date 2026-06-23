import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

interface QuoteLine {
  stock_code: string;
  description: string;
  qty: number;
  unit: string;
  unit_cost: number;
  line_total: number;
}

interface QuoteData {
  project_id: string;
  generated_at: string;
  bom: QuoteLine[];
  labor: Array<{
    task: string;
    crew: number;
    days: number;
    rate_per_day: number;
    total: number;
    rule: string;
  }>;
  hire: { weeks: number; rate_per_week: number; total: number };
  totals: {
    materials: number;
    labor: number;
    hire: number;
    charges: number;
    grand_total: number;
  };
  assumptions: string[];
  verifier_passed: boolean;
}

interface ProjectMeta {
  site_name: string;
  address: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export default async function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quotePath = join(process.cwd(), "artifacts/projects", id, "quote.json");
  const metaPath = join(process.cwd(), "data/projects", id, "meta.json");

  const [quote, meta] = await Promise.all([
    readJson<QuoteData>(quotePath),
    readJson<ProjectMeta>(metaPath),
  ]);

  if (!quote) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-white p-8 text-zinc-900">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: #ffffff !important; }
            main { max-width: none !important; margin: 0 !important; }
          }
        `}
      </style>

      <div className="no-print mb-6 flex items-center justify-between rounded border border-zinc-300 bg-zinc-100 p-3 text-sm">
        <span>Printable quote view — use your browser Print dialog to save as PDF.</span>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${id}/quote`} className="rounded border border-zinc-400 px-3 py-1.5">
            Back to quote tab
          </Link>
        </div>
      </div>

      <header className="mb-8 border-b border-zinc-300 pb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Scaffold Quoter MVP</p>
        <h1 className="text-3xl font-semibold">Scaffold Quote</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {meta?.site_name ?? quote.project_id}
          {meta?.address ? ` · ${meta.address}` : ""}
        </p>
        <p className="text-xs text-zinc-500">Generated: {new Date(quote.generated_at).toLocaleString()}</p>
        <p className={`mt-2 text-sm font-medium ${quote.verifier_passed ? "text-emerald-700" : "text-red-700"}`}>
          Verifier status: {quote.verifier_passed ? "Passed" : "Failed"}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Bill of Materials</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left">
              <th className="py-2 pr-2">Stock code</th>
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Unit cost</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {quote.bom.map((line) => (
              <tr key={line.stock_code} className="border-b border-zinc-200">
                <td className="py-1.5 pr-2 font-mono text-xs">{line.stock_code}</td>
                <td className="py-1.5 pr-2">{line.description}</td>
                <td className="py-1.5 pr-2 text-right">{line.qty}</td>
                <td className="py-1.5 pr-2 text-right">{formatCurrency(line.unit_cost)}</td>
                <td className="py-1.5 text-right">{formatCurrency(line.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Labor</h2>
          <ul className="space-y-2 text-sm">
            {quote.labor.map((line) => (
              <li key={line.task} className="rounded border border-zinc-300 p-3">
                <p className="font-medium capitalize">
                  {line.task}: {formatCurrency(line.total)}
                </p>
                <p>
                  Crew {line.crew} · {line.days} days @ {formatCurrency(line.rate_per_day)}/day
                </p>
                <p className="text-xs text-zinc-600">{line.rule}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Hire & Totals</h2>
          <p className="text-sm">
            Hire: {quote.hire.weeks} weeks × {formatCurrency(quote.hire.rate_per_week)} ={" "}
            {formatCurrency(quote.hire.total)}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Materials: {formatCurrency(quote.totals.materials)}</li>
            <li>Labor: {formatCurrency(quote.totals.labor)}</li>
            <li>Hire: {formatCurrency(quote.totals.hire)}</li>
            <li>Charges: {formatCurrency(quote.totals.charges)}</li>
            <li className="mt-2 border-t border-zinc-300 pt-2 font-semibold">
              Grand Total: {formatCurrency(quote.totals.grand_total)}
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Assumptions</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {quote.assumptions.map((assumption, index) => (
            <li key={`${assumption}-${index}`}>{assumption}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
