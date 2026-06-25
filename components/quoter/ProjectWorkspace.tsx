"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuoterStore } from "../../store/quoter-store";
import IngestForm from "./IngestForm";
import ScaffoldEditor from "./ScaffoldEditor";
import QuotePanel from "./QuotePanel";

const QuoterScene = dynamic(() => import("./QuoterScene"), { ssr: false });

export default function ProjectWorkspace({ projectId = "demo-warehouse" }: { projectId?: string }) {
  const loadProject = useQuoterStore((s) => s.loadProject);
  const activeTab = useQuoterStore((s) => s.activeTab);
  const setActiveTab = useQuoterStore((s) => s.setActiveTab);
  const loading = useQuoterStore((s) => s.loading);
  const error = useQuoterStore((s) => s.error);

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  const tabs = [
    { id: "dimensions" as const, label: "Dimensions" },
    { id: "scaffold" as const, label: "Scaffold" },
    { id: "quote" as const, label: "Quote" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#121316", color: "#e8e4dc" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderBottom: "1px solid #333",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div>
          <Link href="/" style={{ color: "#888", fontSize: 12, textDecoration: "none" }}>
            ← Heritage demos
          </Link>
          <h1 style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 600 }}>Scaffold Quoter</h1>
          <p style={{ margin: 0, fontSize: 11, color: "#888" }}>
            AUS modular bays · AS/NZS 1576 · scaffold-grade massing
          </p>
        </div>
        {loading && <span style={{ fontSize: 12, color: "#d4a017" }}>Deriving…</span>}
        {error && <span style={{ fontSize: 12, color: "#c0392b" }}>{error}</span>}
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: "1 1 60%", minWidth: 0, position: "relative" }}>
          <QuoterScene />
        </div>
        <aside
          style={{
            flex: "0 0 380px",
            borderLeft: "1px solid #333",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <nav style={{ display: "flex", borderBottom: "1px solid #333" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  background: activeTab === t.id ? "#2a2b2e" : "transparent",
                  border: "none",
                  borderBottom: activeTab === t.id ? "2px solid #3d9970" : "2px solid transparent",
                  color: activeTab === t.id ? "#e8e4dc" : "#888",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {activeTab === "dimensions" && <IngestForm />}
            {activeTab === "scaffold" && <ScaffoldEditor />}
            {activeTab === "quote" && <QuotePanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}
