"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuoteStore } from "../../lib/stores/quote-store";

interface QuoteLine {
  stock_code: string;
  description: string;
  qty: number;
  unit: string;
  unit_cost: number;
  line_total: number;
  component_ids: string[];
}

interface QuoteLaborLine {
  task: string;
  crew: number;
  days: number;
  rate_per_day: number;
  total: number;
  rule: string;
}

interface QuoteData {
  project_id: string;
  bom: QuoteLine[];
  labor: QuoteLaborLine[];
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

interface VerifierCheck {
  id: string;
  severity: "critical" | "warning";
  passed: boolean;
  message: string;
}

interface VerifierReport {
  passed: boolean;
  critical_failures: number;
  warning_failures: number;
  checks: VerifierCheck[];
}

interface QuotePanelProps {
  projectId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function QuotePanel({ projectId }: QuotePanelProps) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [verifier, setVerifier] = useState<VerifierReport | null>(null);
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setHighlightIds = useQuoteStore((state) => state.setHighlightIds);
  const highlightedCount = useQuoteStore((state) => state.highlightIds.length);

  useEffect(() => {
    let active = true;
    const loadQuote = async () => {
      try {
        const [quoteResponse, verifierResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}/quote`),
          fetch(`/api/projects/${projectId}/verifier-report`),
        ]);

        if (!quoteResponse.ok) {
          throw new Error("Quote artifact not found. Run pipeline to generate quote output.");
        }

        const quoteData = (await quoteResponse.json()) as QuoteData;
        if (!active) return;

        setQuote(quoteData);

        if (verifierResponse.ok) {
          const verifierData = (await verifierResponse.json()) as VerifierReport;
          if (active) setVerifier(verifierData);
        } else if (active) {
          setVerifier(null);
        }
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadQuote();

    return () => {
      active = false;
    };
  }, [projectId]);

  const exportEnabled = useMemo(() => {
    if (!quote) return false;
    if (typeof verifier?.passed === "boolean") return verifier.passed;
    return quote.verifier_passed;
  }, [quote, verifier]);

  const onRowClick = (line: QuoteLine) => {
    setSelectedStockCode(line.stock_code);
    setHighlightIds(line.component_ids ?? []);
  };

  const clearHighlight = () => {
    setSelectedStockCode(null);
    setHighlightIds([]);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Quote panel</p>
          <h1 className="text-2xl font-semibold text-zinc-50">BOM, labor, hire, and totals</h1>
          <p className="text-sm text-zinc-400">
            Click a BOM row to set highlighted scaffold component IDs for the 3D scene.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              exportEnabled ? "bg-emerald-600/20 text-emerald-200" : "bg-red-600/20 text-red-200"
            }`}
          >
            {exportEnabled ? "Verifier passed" : "Verifier failed"}
          </span>
          <Link
            href={`/projects/${projectId}/quote/print`}
            target="_blank"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              exportEnabled
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "pointer-events-none bg-zinc-700 text-zinc-400"
            }`}
          >
            Export / Print
          </Link>
        </div>
      </header>

      {loading ? <p className="text-sm text-zinc-400">Loading quote artifacts…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {quote ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Materials</p>
              <p className="mt-2 text-xl font-semibold">{formatCurrency(quote.totals.materials)}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Labor + hire + charges</p>
              <p className="mt-2 text-xl font-semibold">
                {formatCurrency(quote.totals.labor + quote.totals.hire + quote.totals.charges)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Grand total</p>
              <p className="mt-2 text-xl font-semibold text-emerald-300">
                {formatCurrency(quote.totals.grand_total)}
              </p>
            </div>
          </div>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900/70">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">Bill of materials</h2>
              <div className="flex items-center gap-3">
                <p className="text-xs text-zinc-400">Highlighted components: {highlightedCount}</p>
                <button
                  type="button"
                  onClick={clearHighlight}
                  className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Clear highlight
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Unit cost</th>
                    <th className="px-4 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.bom.map((line) => {
                    const selected = selectedStockCode === line.stock_code;
                    return (
                      <tr
                        key={line.stock_code}
                        className={`cursor-pointer border-b border-zinc-800/70 ${
                          selected ? "bg-emerald-700/20" : "hover:bg-zinc-800/70"
                        }`}
                        onClick={() => onRowClick(line)}
                      >
                        <td className="px-4 py-2 font-mono text-xs">{line.stock_code}</td>
                        <td className="px-4 py-2">{line.description}</td>
                        <td className="px-4 py-2 text-right">{line.qty}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(line.unit_cost)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(line.line_total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Labor</h2>
              <ul className="space-y-2 text-sm">
                {quote.labor.map((line) => (
                  <li key={line.task} className="rounded border border-zinc-800 bg-zinc-950/40 p-3">
                    <p className="font-medium capitalize text-zinc-200">
                      {line.task}: {formatCurrency(line.total)}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Crew {line.crew} · {line.days} days @ {formatCurrency(line.rate_per_day)}/day
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{line.rule}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Hire & assumptions</h2>
              <p className="text-sm text-zinc-300">
                Hire: {quote.hire.weeks} weeks × {formatCurrency(quote.hire.rate_per_week)} ={" "}
                {formatCurrency(quote.hire.total)}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                {quote.assumptions.map((assumption, index) => (
                  <li key={`${assumption}-${index}`}>{assumption}</li>
                ))}
              </ul>
            </section>
          </div>

          {verifier ? (
            <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-300">Verifier checks</h2>
              <p className="mb-3 text-sm text-zinc-400">
                Critical failures: {verifier.critical_failures} · Warnings: {verifier.warning_failures}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {verifier.checks.map((check, index) => (
                  <div
                    key={`${check.id}-${index}`}
                    className={`rounded border px-3 py-2 text-xs ${
                      check.passed
                        ? "border-emerald-700/40 bg-emerald-700/10 text-emerald-200"
                        : check.severity === "critical"
                          ? "border-red-700/40 bg-red-700/10 text-red-200"
                          : "border-amber-700/40 bg-amber-700/10 text-amber-200"
                    }`}
                  >
                    <p className="font-semibold">
                      {check.id} · {check.severity}
                    </p>
                    <p>{check.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
