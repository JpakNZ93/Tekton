"use client";

import dynamic from "next/dynamic";

const ProjectWorkspace = dynamic(() => import("../../components/quoter/ProjectWorkspace"), { ssr: false });

export default function QuoterPage() {
  return <ProjectWorkspace projectId="demo-warehouse" />;
}
