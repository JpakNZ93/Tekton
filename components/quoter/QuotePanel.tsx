"use client";

import { useQuoterStore } from "../../store/quoter-store";
import { downloadQuotePdf } from "../../lib/quoter/export-quote-pdf";

export default function QuotePanel() {
  const quote = useQuoterStore((s) => s.quote) as {
    bom?: { stock_code: string; description: string; qty: number; unit_cost: number; line_total: number }[];
    labor?: { task: string; crew: number; days: number; line_total: number }[];
    hire?: { weeks: number; line_total: number };
    totals?: { materials: number; labor: number; hire: number; grand_total: number };
    assumptions?: string[];
    confidence?: { surveyed_pct: number; assumed_pct: number; derived_pct: number };
  } | null;
  const report = useQuoterStore((s) => s.report) as { passed?: boolean } | null;
  const canonical = useQuoterStore((s) => s.canonical) as { meta?: { site_name?: string } } | null;
  const highlightBom = useQuoterStore((s) => s.highlightBom);
  const highlightStockCode = useQuoterStore((s) => s.highlightStockCode);

  if (!quote?.bom) return <p style={{ color: "#888" }}>No quote loaded</p>;

  const exportBlocked = report && !report.passed;

  return (
    <div style={{ fontSize: 12, color: "#ccc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#e8e4dc" }}>Quote</h3>
        <button
          type="button"
          disabled={!!exportBlocked}
          onClick={() => downloadQuotePdf(quote, canonical?.meta?.site_name || "Project")}
          style={{
            ...exportBtn,
            opacity: exportBlocked ? 0.4 : 1,
            cursor: exportBlocked ? "not-allowed" : "pointer",
          }}
          title={exportBlocked ? "Fix verifier failures before export" : "Export PDF"}
        >
          Export PDF
        </button>
      </div>

      {quote.confidence && (
        <p style={{ fontSize: 11, color: "#888" }}>
          Confidence: surveyed {(quote.confidence.surveyed_pct * 100).toFixed(0)}% · assumed{" "}
          {(quote.confidence.assumed_pct * 100).toFixed(0)}%
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #444", textAlign: "left" }}>
            <th style={th}>Code</th>
            <th style={th}>Qty</th>
            <th style={th}>Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.bom.map((line) => (
            <tr
              key={line.stock_code}
              onClick={() => highlightBom(highlightStockCode === line.stock_code ? null : line.stock_code)}
              style={{
                borderBottom: "1px solid #333",
                cursor: "pointer",
                background: highlightStockCode === line.stock_code ? "#3d3a2a" : "transparent",
              }}
            >
              <td style={td}>
                <div style={{ color: "#e8e4dc" }}>{line.stock_code}</div>
                <div style={{ fontSize: 10, color: "#888" }}>{line.description}</div>
              </td>
              <td style={td}>{line.qty}</td>
              <td style={td}>${line.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ color: "#e8e4dc" }}>
        Materials: ${quote.totals?.materials?.toFixed(2)} · Labor: ${quote.totals?.labor?.toFixed(2)} · Hire: $
        {quote.totals?.hire?.toFixed(2)}
      </p>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#3d9970" }}>
        Grand total: ${quote.totals?.grand_total?.toFixed(2)} AUD
      </p>

      <h4 style={{ color: "#e8e4dc", marginTop: 16 }}>Assumptions</h4>
      <ul style={{ paddingLeft: 16, color: "#aaa", fontSize: 11 }}>
        {quote.assumptions?.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

const th: React.CSSProperties = { padding: "4px 0", color: "#888", fontWeight: 500 };
const td: React.CSSProperties = { padding: "6px 0" };
const exportBtn: React.CSSProperties = {
  background: "#5e6ca8",
  border: "none",
  color: "#fff",
  padding: "6px 12px",
  fontSize: 11,
};
