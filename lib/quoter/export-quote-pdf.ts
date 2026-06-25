export function exportQuoteHtml(quote: Record<string, unknown>, siteName: string) {
  const q = quote as {
    bom: { stock_code: string; description: string; qty: number; unit_cost: number; line_total: number }[];
    labor: { task: string; crew: number; days: number; rate_per_day: number; line_total: number }[];
    hire: { weeks: number; rate_per_week: number; line_total: number };
    totals: { materials: number; labor: number; hire: number; grand_total: number; margin: number };
    assumptions: string[];
    confidence: { surveyed_pct: number; assumed_pct: number; derived_pct: number };
  };

  const bomRows = q.bom
    .map(
      (l) =>
        `<tr><td>${l.stock_code}</td><td>${l.description}</td><td>${l.qty}</td><td>$${l.unit_cost.toFixed(2)}</td><td>$${l.line_total.toFixed(2)}</td></tr>`
    )
    .join("");

  const laborRows = q.labor
    .map(
      (l) =>
        `<tr><td>${l.task}</td><td>${l.crew}</td><td>${l.days}</td><td>$${l.rate_per_day}</td><td>$${l.line_total.toFixed(2)}</td></tr>`
    )
    .join("");

  const assumptions = q.assumptions.map((a) => `<li>${a}</li>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Quote — ${siteName}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; color: #1a1a1a; }
  h1 { font-size: 1.5rem; } table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 0.9rem; }
  th { background: #f4f4f4; } .total { font-weight: bold; font-size: 1.1rem; margin-top: 1rem; }
  @media print { body { margin: 1cm; } }
</style></head><body>
<h1>Scaffold Quoter — ${siteName}</h1>
<p>Australian modular scaffold (AS/NZS 1576). Scaffold-grade massing — not architectural BIM.</p>
<h2>Bill of Materials</h2>
<table><thead><tr><th>Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
<tbody>${bomRows}</tbody></table>
<h2>Labor</h2>
<table><thead><tr><th>Task</th><th>Crew</th><th>Days</th><th>Rate/day</th><th>Total</th></tr></thead>
<tbody>${laborRows}</tbody></table>
<h2>Hire</h2>
<p>${q.hire.weeks} weeks @ $${q.hire.rate_per_week}/week = $${q.hire.line_total.toFixed(2)}</p>
<h2>Confidence</h2>
<p>Surveyed ${(q.confidence.surveyed_pct * 100).toFixed(0)}% · Derived ${(q.confidence.derived_pct * 100).toFixed(0)}% · Assumed ${(q.confidence.assumed_pct * 100).toFixed(0)}%</p>
<h2>Assumptions</h2>
<ul>${assumptions}</ul>
<p class="total">Grand total: $${q.totals.grand_total.toFixed(2)} AUD (incl. $${q.totals.margin.toFixed(2)} margin)</p>
<script>window.onload = () => window.print();</script>
</body></html>`;
}

export function downloadQuotePdf(quote: Record<string, unknown>, siteName: string) {
  const html = exportQuoteHtml(quote, siteName);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
